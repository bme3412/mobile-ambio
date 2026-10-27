"""Reconcile completed OpenAI reservations from cached usage: --date YYYY-MM-DD [--apply]."""
import argparse
import datetime as dt
from decimal import Decimal
import json
from .storage import Storage

# Conservative upper rates for both pinned models; cached-input discounts ignored.
# https://developers.openai.com/api/docs/models/gpt-5.4
MODELS={'gpt-5.4-2026-03-05','gpt-5.4-mini-2026-03-17'}
INPUT_RATE=Decimal('2.5')
OUTPUT_RATE=Decimal('15')

def verified_cost(event,response):
    if event['provider']!='api.openai.com' or event['status']!='completed':return None
    usage=response.get('usage',{})
    if response.get('model') not in MODELS or usage!=event.get('usage'):return None
    counts=[usage.get(k) for k in ('input_tokens','output_tokens')]
    if any(type(n) is not int or n<0 for n in counts):return None
    amount=(counts[0]*INPUT_RATE+counts[1]*OUTPUT_RATE)/Decimal(1000000)
    if amount>Decimal(str(event['reserved_usd'])):return None
    return amount

def reconcile(date,apply=False):
    dt.date.fromisoformat(date);s=Storage()
    run=s.rows(f'edition_runs?run_date=eq.{date}&select=owner,reserved_usd')[0]
    if run['owner']:raise ValueError('Wait for the active run to release its lease before reconciliation')
    events=s.rows(f'edition_cost_events?run_date=eq.{date}&provider=eq.api.openai.com&status=eq.completed&settled_usd=is.null')
    released=Decimal(0);count=0
    for event in events:
        raw=s.get('edition-work',f"{date}/requests/{event['request_hash']}.json")
        if not raw:continue
        response=json.loads(raw);amount=verified_cost(event,response)
        if amount is None:continue
        basis={'model':response['model'],'inputRatePerMillion':str(INPUT_RATE),'outputRatePerMillion':str(OUTPUT_RATE),'usage':response['usage'],'method':'cached response usage; undiscounted conservative rates'}
        if apply and not s.rpc('settle_edition_cost',p_event=event['id'],p_actual=str(amount),p_basis=basis):raise ValueError('Cost settlement conflict')
        released+=Decimal(str(event['reserved_usd']))-amount;count+=1
    print(json.dumps({'applied':apply,'verifiedCompletedCalls':count,'releasedUsd':str(released),'remainingReservedUsd':str(Decimal(str(run['reserved_usd']))-released)}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--date',required=True);parser.add_argument('--apply',action='store_true')
    args=parser.parse_args();reconcile(args.date,args.apply)
