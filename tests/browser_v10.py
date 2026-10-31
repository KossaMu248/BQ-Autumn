"""Current adventure regression entry; older scripts remain usable."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('browser_v9.py')),run_name='__main__')
