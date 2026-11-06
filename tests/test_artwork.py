import io
import json
import unittest
from unittest.mock import patch
from PIL import Image
from scripts.daily.artwork import license_info, search_photos, jpeg_pair, select_story_artwork, MAX_PAYLOAD


def metadata(license='CC BY 4.0', url='https://creativecommons.org/licenses/by/4.0/'):
    return {k: {'value': v} for k, v in {'Artist': '<a>Ada Photographer</a>', 'LicenseShortName': license,
        'LicenseUrl': url, 'ImageDescription': 'Photograph of the Louvre in Paris'}.items()}


def candidate(meta=None):
    return {'pageid': 1, 'title': 'File:Louvre photograph.jpg', 'imageinfo': [{
        'mime': 'image/jpeg', 'width': 1800, 'height': 1200,
        'thumburl': 'https://upload.wikimedia.org/photo.jpg',
        'descriptionurl': 'https://commons.wikimedia.org/wiki/File:Louvre.jpg',
        'extmetadata': meta or metadata()}]}


class ArtworkTests(unittest.TestCase):
    def test_license_requires_complete_attribution_and_allowlisted_license(self):
        self.assertEqual(license_info(metadata())['creator'], 'Ada Photographer')
        for name in ['CC BY-SA 4.0', 'CC BY-NC 4.0', '', 'All rights reserved']:
            self.assertIsNone(license_info(metadata(name)))
        self.assertIsNone(license_info(metadata(url='https://example.com/license')))
        m = metadata(); del m['Artist']
        self.assertIsNone(license_info(m))
        self.assertIsNotNone(license_info(metadata('CC0', 'https://creativecommons.org/publicdomain/zero/1.0/')))
        self.assertIsNotNone(license_info(metadata('Public domain', '')))

    def test_non_photos_untrusted_urls_and_undersized_images_rejected(self):
        rows = [candidate()]
        drawing = candidate(); drawing['imageinfo'][0]['extmetadata']['ImageDescription']['value'] = 'Painting of Louvre'
        rows.append(drawing)
        external = candidate(); external['imageinfo'][0]['thumburl'] = 'https://example.com/a.jpg'; rows.append(external)
        small = candidate(); small['imageinfo'][0]['width'] = 200; rows.append(small)
        result = search_photos('Louvre', lambda *args: json.dumps({'query': {'pages': rows}}).encode())
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['sourcePage'], 'https://commons.wikimedia.org/wiki/File:Louvre.jpg')

    def test_jpeg_pair_is_bounded_and_decodable(self):
        output = io.BytesIO(); Image.new('RGB', (1800, 1200), 'blue').save(output, 'JPEG')
        hero, thumbnail = jpeg_pair(output.getvalue())
        self.assertTrue(hero.startswith('data:image/jpeg;base64,/9j/'))
        self.assertLess(len(thumbnail), len(hero))
        self.assertLess(len(hero) + len(thumbnail), MAX_PAYLOAD // 3)
        with self.assertRaises(Exception): jpeg_pair(b'not a photograph')

    def test_detailed_photographs_reduce_dimensions_to_fit_budget(self):
        import base64
        import random
        noise = random.Random(42).randbytes(1800 * 1200 * 3)
        output = io.BytesIO()
        Image.frombytes('RGB', (1800, 1200), noise).save(output, 'JPEG', quality=95)
        hero, thumbnail = jpeg_pair(output.getvalue())
        raw = base64.b64decode(hero.split(',')[1])
        self.assertLessEqual(len(raw), 115000)
        self.assertLessEqual(len(base64.b64decode(thumbnail.split(',')[1])), 15000)
        self.assertLessEqual(max(Image.open(io.BytesIO(raw)).size), 1200)

    def test_checkpoint_reuses_selection_but_invalidates_changed_story(self):
        editorial = {'stories': [{'id': 'a', 'title': 'Louvre', 'description': 'Paris museum'}]}
        checkpoint = {}; save = unittest.mock.Mock()
        with patch('scripts.daily.artwork.select_story', return_value={'dataUri': 'photo'}) as choose:
            first = select_story_artwork(None, editorial, checkpoint, save)
            self.assertEqual(first, select_story_artwork(None, editorial, checkpoint, save))
            choose.assert_called_once()
            editorial['stories'][0]['description'] = 'New subject'
            select_story_artwork(None, editorial, checkpoint, save)
            self.assertEqual(choose.call_count, 2)

    def test_failures_and_no_match_do_not_block_or_repeat_work(self):
        editorial = {'stories': [{'id': 'a'}, {'id': 'b'}]}; checkpoint = {}
        with patch('scripts.daily.artwork.select_story', side_effect=[TimeoutError(), None]) as choose:
            self.assertEqual(select_story_artwork(None, editorial, checkpoint), {})
            self.assertEqual(select_story_artwork(None, editorial, checkpoint), {})
            self.assertEqual(choose.call_count, 2)

    def test_total_payload_includes_base64_and_metadata(self):
        editorial = {'stories': [{'id': str(i)} for i in range(3)]}
        with patch('scripts.daily.artwork.select_story', return_value={'dataUri': 'a' * 250000}):
            photos = select_story_artwork(None, editorial, {})
        self.assertEqual(len(photos), 2)
        self.assertLessEqual(len(json.dumps(photos).encode()), MAX_PAYLOAD)

    @patch('scripts.daily.artwork.generate')
    def test_unmatched_candidate_is_not_downloaded(self, generate):
        from scripts.daily.artwork import select_story
        generate.side_effect = [{'query': 'Louvre'}, {'id': '', 'description': '', 'caption': ''}]
        fetch = unittest.mock.Mock(return_value=json.dumps({'query': {'pages': [candidate()]}}).encode())
        self.assertIsNone(select_story(None, {'title': 'Unrelated story'}, fetch))
        self.assertEqual(fetch.call_count, 1)

    @patch('scripts.daily.artwork.generate')
    def test_selected_photo_keeps_source_attribution(self, generate):
        from scripts.daily.artwork import select_story
        generate.side_effect = [{'query': 'Louvre museum Paris'}, {'id': '1', 'description': 'Louvre courtyard', 'caption': 'Museum in Paris; not the reported event.'}]
        output = io.BytesIO(); Image.new('RGB', (1200, 800), 'blue').save(output, 'JPEG')
        fetch = unittest.mock.Mock(side_effect=[json.dumps({'query': {'pages': [candidate()]}}).encode(), output.getvalue()])
        photo = select_story(None, {'title': 'Louvre exhibition'}, fetch)
        self.assertEqual(photo['creator'], 'Ada Photographer')
        self.assertEqual(photo['license'], 'CC BY 4.0')
        self.assertTrue(photo['caption'].startswith('Contextual photograph.'))
        self.assertTrue(photo['thumbnailDataUri'].startswith('data:image/jpeg;base64,'))
