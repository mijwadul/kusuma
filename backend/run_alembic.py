import os
import sys

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import alembic.config

alembic_args = [
    'revision',
    '--autogenerate',
    '-m',
    'Add hauling vendor trucks and prices'
]
alembic.config.main(argv=alembic_args)
