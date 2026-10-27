"""Strict provider schemas; wire arrays become the app's word-keyed dictionaries."""
import copy

def obj(properties):
    return {'type':'object','properties':properties,'required':list(properties),'additionalProperties':False}
def arr(items,**limits):return {'type':'array','items':items,**limits}
S={'type':'string'}
I={'type':'integer','minimum':0}
VOCAB=obj({'word':S,**{k:S for k in ('meaning','pronunciation','kind','example','translation')}})
DRAFT=obj({
    'editorial':obj({**{k:S for k in ('title','subtitle','edition','speakingPrompt')},
        'turns':arr(arr(S,minItems=3,maxItems=3),minItems=8,maxItems=100),
        'stories':arr(obj({**{k:S for k in ('id','category','title','description')},'segmentIndex':I}),minItems=3,maxItems=3),
        'sources':arr(obj({k:S for k in ('title','publisher','url')}),minItems=3)}),
    'pairs':arr(arr(arr(S,minItems=2,maxItems=2))),
    'vocabulary':arr(VOCAB,minItems=8,maxItems=12),
})
REVIEW=obj({'passed':{'type':'boolean'},'issues':arr(S),'claims':arr(obj({k:S for k in ('claim','url','evidence')}))})

def to_wire(draft):
    d=copy.deepcopy(draft)
    if isinstance(d.get('definitions'),dict):d['definitions']=[{'word':k,'meaning':v} for k,v in d['definitions'].items()]
    if isinstance(d.get('vocabulary'),dict):d['vocabulary']=[{'word':k,**v} for k,v in d['vocabulary'].items()]
    return d

def from_wire(draft):
    d=copy.deepcopy(draft)
    for name in ('definitions','vocabulary'):
        rows=d.get(name,[])
        if not isinstance(rows,list):raise ValueError(name+' must contain word entries')
        if len({r['word'] for r in rows})!=len(rows):raise ValueError('Duplicate '+name+' word')
        d[name]={r['word']:(r['meaning'] if name=='definitions' else {k:v for k,v in r.items() if k!='word'}) for r in rows}
    return d
