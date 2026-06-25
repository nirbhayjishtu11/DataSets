# Msite MCAT Mart Dashboard

Streamlit dashboard for `im_datamart.msite_mcat_mart` (daily / weekly / monthly grain).

## Run

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Data

Place a CSV export of the mart at `data/msite_mcat_mart.csv`, or upload it from the
sidebar at runtime. Expected columns follow the mart SRS: `datatype` (1=daily,
2=weekly, 3=monthly), `start_date`, `end_date`, `page_type`
(overall/all_india/city/pmcat/mcat/spec), `usermode`
(overall/unidentified/identified/full_login), `source`
(overall/organic/prd_ads/affiliate/internal/others), the core funnel KPIs
(enquiry/WhatsApp/BL/intent BL/calls/unique senders), and the GA click-event
columns. Missing columns are skipped gracefully — sections only render for
metrics actually present in the file.
