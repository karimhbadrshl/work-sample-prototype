"""Karim brand (paper theme) for the Streamlit app: fonts, colour tokens, brick mark, stud rule.

Tokens come from the karim-brand skill. Theme colours also live in .streamlit/config.toml.
Rules kept here: one yellow thing per screen (the score), red only for flags and always with a word,
sentence-case claim headings, numbers with n in IBM Plex Mono.
"""
import streamlit as st

PAPER = {
    "ground": "#F2EFE6", "ground_raised": "#FBFAF6", "ink": "#22252B", "ink_muted": "#62666E",
    "yellow": "#B07A0C", "yellow_text": "#8A5F07", "blue": "#2F5DA8", "red": "#B8392C",
    "stud": "#B9B2A2", "hairline": "#D9D4C7",
}

BRICK_MARK = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="22" viewBox="0 0 34 22"><g fill="#B07A0C">'
    '<rect x="0" y="5" width="34" height="17" rx="2"/><rect x="5" y="0" width="8" height="6" rx="1"/>'
    '<rect x="21" y="0" width="8" height="6" rx="1"/></g></svg>'
)
STUD_RULE = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="130" height="8" viewBox="0 0 130 8">'
    + "".join(f'<circle cx="{4 + 12 * i}" cy="4" r="3" fill="{PAPER["hairline"]}"/>' for i in range(11))
    + "</svg>"
)

CSS = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Rubik:wght@400;500&display=swap');
/* Text elements only. A broad selector would also hit Streamlit's icon font and show icon names as text. */
html, body, p, li, label, textarea, input, button, [data-testid="stMarkdownContainer"] {{
  font-family: 'Rubik', 'Segoe UI', Arial, sans-serif !important;
}}
[data-testid="stIconMaterial"] {{ font-family: 'Material Symbols Rounded' !important; }}
h1, h2, h3 {{ font-family: 'Rubik', 'Segoe UI', Arial, sans-serif !important; font-weight: 500 !important; color: {PAPER['ink']}; }}
code, pre, .kb-mono, [data-testid="stCaptionContainer"] {{ font-family: 'IBM Plex Mono', Consolas, monospace !important; }}
.kb-kicker {{ font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 0.8rem; letter-spacing: .06em;
  text-transform: uppercase; color: {PAPER['ink_muted']}; display: flex; align-items: center; gap: 10px; }}
.kb-tag {{ font-family: 'IBM Plex Mono', Consolas, monospace; font-size: .75rem; padding: 1px 6px; border-radius: 4px;
  border: 1px solid {PAPER['hairline']}; color: {PAPER['ink_muted']}; margin-right: 6px; }}
.kb-tag.present {{ border-color: {PAPER['ink']}; color: {PAPER['ink']}; }}
[data-testid="stMetricValue"] {{ color: {PAPER['yellow']} !important; font-weight: 500; }}
</style>
"""


def apply(kicker: str, title: str):
    """Call once at the top of the app: fonts and CSS, then brick mark + kicker, then the claim title."""
    st.markdown(CSS, unsafe_allow_html=True)
    st.markdown(f'<div class="kb-kicker">{BRICK_MARK}<span>{kicker}</span></div>', unsafe_allow_html=True)
    st.title(title)


def tag(label: str, present: bool) -> str:
    """Text tag in place of emoji ticks (brand: no emoji bullets)."""
    return f'<span class="kb-tag{" present" if present else ""}">{label}</span>'


def footer(text: str):
    st.markdown(STUD_RULE, unsafe_allow_html=True)
    st.caption(text)
