"""Compatibility entry for current adventure checks."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('browser_v8.py')),run_name='__main__')
