"""Streamlit dashboard for im_datamart.msite_mcat_mart."""

import pandas as pd
import plotly.express as px
import streamlit as st

DATA_PATH = "data/msite_mcat_mart.csv"

DIMENSIONS = ["datatype", "page_type", "usermode", "source"]

FUNNEL_GROUPS = {
    "Enquiry": ["enq_generated", "enq_gen_sender", "enq_approved", "enq_app_sender"],
    "WhatsApp": ["wa_generated", "wa_gen_sender", "wa_approved", "wa_app_sender"],
    "Business Listing": [
        "bl_generated", "bl_gen_sender", "bl_approved", "bl_app_sender",
        "bl_gen_with_wa", "bl_wa_gen_sender", "bl_wa_approved", "bl_wa_app_sender",
    ],
    "Intent BL": ["intent_bl_generated", "intent_user_approved"],
    "Calls": ["c2c_calls", "c2c_u_calls", "c2c_callers", "pns_calls", "normal_calls"],
    "Unique Senders": ["unq_sender", "unq_sender_no_call"],
}

GA_EVENT_COLS = [
    "product_listing_click", "inline_bl_cta_clicks", "getquote_onpage_cta_click",
    "miniBL_cta_click", "featcat_bl_click", "3rdpv_cta_click", "6thpv_cta_click",
    "get_best_price_click", "price_on_request_click", "ask_for_clicks",
    "recom_enquiry_click", "listing_wa_cta_clicks", "recom_wa_click",
    "inline_call_cta_clicks", "recom_call_click", "recom_category_click",
    "recom_product_click", "video_visible", "video_autoplay", "video_clicks",
]

KPI_CARD_METRICS = [
    "enq_generated", "wa_generated", "bl_generated", "c2c_calls", "unq_sender",
]

DATATYPE_LABELS = {1: "Daily", 2: "Weekly", 3: "Monthly"}


@st.cache_data
def load_data(path):
    df = pd.read_csv(path)
    for col in ("start_date", "end_date"):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    if "datatype" in df.columns:
        df["grain"] = df["datatype"].map(DATATYPE_LABELS).fillna(df["datatype"].astype(str))
    return df


def sidebar_filters(df):
    st.sidebar.header("Filters")

    grain_col = "grain" if "grain" in df.columns else None
    if grain_col:
        grains = sorted(df[grain_col].dropna().unique())
        selected_grain = st.sidebar.radio("Grain", grains, index=0)
        df = df[df[grain_col] == selected_grain]

    for dim, label in [("page_type", "Page Type"), ("usermode", "User Mode"), ("source", "Source")]:
        if dim in df.columns:
            options = sorted(df[dim].dropna().unique())
            selected = st.sidebar.multiselect(label, options, default=options)
            if selected:
                df = df[df[dim].isin(selected)]

    if "start_date" in df.columns and df["start_date"].notna().any():
        min_d, max_d = df["start_date"].min(), df["start_date"].max()
        date_range = st.sidebar.date_input("Date range", value=(min_d, max_d), min_value=min_d, max_value=max_d)
        if isinstance(date_range, tuple) and len(date_range) == 2:
            start, end = pd.Timestamp(date_range[0]), pd.Timestamp(date_range[1])
            df = df[(df["start_date"] >= start) & (df["start_date"] <= end)]

    return df


def kpi_cards(df):
    cols = st.columns(len(KPI_CARD_METRICS))
    for col, metric in zip(cols, KPI_CARD_METRICS):
        if metric in df.columns:
            col.metric(metric.replace("_", " ").title(), f"{df[metric].sum():,.0f}")


def trend_section(df):
    st.subheader("Trend over time")
    if "start_date" not in df.columns:
        st.info("No date column available for trend chart.")
        return

    group = st.selectbox("Funnel group", list(FUNNEL_GROUPS.keys()), key="trend_group")
    available = [c for c in FUNNEL_GROUPS[group] if c in df.columns]
    if not available:
        st.info("None of these columns are present in the loaded data.")
        return

    metrics = st.multiselect("Metrics", available, default=available[:2], key="trend_metrics")
    if not metrics:
        return

    trend = df.groupby("start_date")[metrics].sum().reset_index()
    melted = trend.melt(id_vars="start_date", var_name="metric", value_name="value")
    fig = px.line(melted, x="start_date", y="value", color="metric", markers=True)
    st.plotly_chart(fig, use_container_width=True)


def pagetype_breakdown(df):
    st.subheader("Page Type Breakdown")
    if "page_type" not in df.columns:
        st.info("No page_type column available.")
        return

    group = st.selectbox("Funnel group", list(FUNNEL_GROUPS.keys()), key="pt_group")
    available = [c for c in FUNNEL_GROUPS[group] if c in df.columns]
    if not available:
        st.info("None of these columns are present in the loaded data.")
        return

    metric = st.selectbox("Metric", available, key="pt_metric")
    agg = df.groupby("page_type")[metric].sum().reset_index().sort_values(metric, ascending=False)
    fig = px.bar(agg, x="page_type", y=metric, color="page_type")
    st.plotly_chart(fig, use_container_width=True)


def funnel_chart(df):
    st.subheader("Generated vs Approved")
    pairs = {
        "Enquiry": ("enq_generated", "enq_approved"),
        "WhatsApp": ("wa_generated", "wa_approved"),
        "Business Listing": ("bl_generated", "bl_approved"),
        "Intent BL": ("intent_bl_generated", "intent_user_approved"),
    }
    rows = []
    for name, (gen_col, app_col) in pairs.items():
        if gen_col in df.columns and app_col in df.columns:
            rows.append({"funnel": name, "Generated": df[gen_col].sum(), "Approved": df[app_col].sum()})
    if not rows:
        st.info("No generated/approved column pairs available.")
        return
    funnel_df = pd.DataFrame(rows).melt(id_vars="funnel", var_name="stage", value_name="value")
    fig = px.bar(funnel_df, x="funnel", y="value", color="stage", barmode="group")
    st.plotly_chart(fig, use_container_width=True)


def ga_events_section(df):
    st.subheader("GA Click Events")
    available = [c for c in GA_EVENT_COLS if c in df.columns]
    if not available:
        st.info("No GA click event columns found in the loaded data.")
        return

    totals = df[available].sum().sort_values(ascending=False).reset_index()
    totals.columns = ["event", "count"]
    fig = px.bar(totals, x="count", y="event", orientation="h")
    fig.update_layout(yaxis=dict(categoryorder="total ascending"))
    st.plotly_chart(fig, use_container_width=True)

    if "start_date" in df.columns:
        selected = st.multiselect("Trend for events", available, default=available[:3], key="ga_trend")
        if selected:
            trend = df.groupby("start_date")[selected].sum().reset_index()
            melted = trend.melt(id_vars="start_date", var_name="event", value_name="count")
            fig2 = px.line(melted, x="start_date", y="count", color="event", markers=True)
            st.plotly_chart(fig2, use_container_width=True)


def main():
    st.set_page_config(page_title="Msite MCAT Mart", layout="wide")
    st.title("Msite MCAT Mart Dashboard")

    uploaded = st.sidebar.file_uploader("Upload mart export (CSV)", type="csv")
    if uploaded is not None:
        df = pd.read_csv(uploaded)
        for col in ("start_date", "end_date"):
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors="coerce")
        if "datatype" in df.columns:
            df["grain"] = df["datatype"].map(DATATYPE_LABELS).fillna(df["datatype"].astype(str))
    else:
        try:
            df = load_data(DATA_PATH)
        except FileNotFoundError:
            st.warning(
                f"No data found at `{DATA_PATH}`. Upload a CSV export of msite_mcat_mart "
                "using the sidebar to populate the dashboard."
            )
            return

    filtered = sidebar_filters(df)

    kpi_cards(filtered)

    tab_funnel, tab_trend, tab_pagetype, tab_ga, tab_data = st.tabs(
        ["Generated vs Approved", "Trend", "Page Type", "GA Click Events", "Raw Data"]
    )
    with tab_funnel:
        funnel_chart(filtered)
    with tab_trend:
        trend_section(filtered)
    with tab_pagetype:
        pagetype_breakdown(filtered)
    with tab_ga:
        ga_events_section(filtered)
    with tab_data:
        st.dataframe(filtered, use_container_width=True)


if __name__ == "__main__":
    main()
