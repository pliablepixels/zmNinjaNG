# zmNinjaNG Documentation - Sphinx Configuration

import os
import sys

# -- Project information -----------------------------------------------------

project = 'zmNinjaNG'
copyright = '2025-2026, pliablepixels'
author = 'pliablepixels'
release = '0.2.4'

# -- General configuration ---------------------------------------------------

extensions = [
    'myst_parser',
    'sphinx.ext.autosectionlabel',
    'sphinx_copybutton',
]

# MyST parser settings
myst_enable_extensions = [
    'colon_fence',
    'deflist',
    'fieldlist',
    'tasklist',
]
myst_heading_anchors = 3

# Auto section label - prefix with doc name to avoid duplicates
autosectionlabel_prefix_document = True
autosectionlabel_maxdepth = 3

suppress_warnings = ['autosectionlabel.*', 'misc.highlighting_failure']

templates_path = ['_templates']
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']

# Source file suffixes
source_suffix = {
    '.rst': 'restructuredtext',
    '.md': 'markdown',
}

# -- Options for HTML output -------------------------------------------------

html_theme = 'sphinx_rtd_theme'

html_theme_options = {
    'logo_only': True,
    'prev_next_buttons_location': 'bottom',
    'style_external_links': True,
    'collapse_navigation': False,
    'sticky_navigation': True,
    'navigation_depth': 4,
    'includehidden': True,
    'titles_only': False,
}

html_logo = '_static/img/logo.png'
html_favicon = '_static/img/logo.png'

html_static_path = ['_static']
html_css_files = ['css/custom.css']
html_js_files = ['js/collapse-nav.js']

html_context = {
    'display_github': True,
    'github_user': 'pliablepixels',
    'github_repo': 'zmNinjaNG',
    'github_version': 'main',
    'conf_py_path': '/docs/',
}

# -- Options for copy button -------------------------------------------------

copybutton_prompt_text = r'^\$ '
copybutton_prompt_is_regexp = True
