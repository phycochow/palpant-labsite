"""
Palpant Lab Website - Main Flask Application
Serves homepage and coordinates tool modules
"""

from flask import Flask, render_template, send_from_directory
from jinja2 import ChoiceLoader, FileSystemLoader
import os
import sys
import logging

# Add parent directory to path for imports
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
)

# Initialize Flask app
app = Flask(__name__)
app.logger.setLevel('INFO')
app.logger.info('Flask application startup')

# Configure template loading from multiple directories
app.jinja_loader = ChoiceLoader([
    FileSystemLoader(os.path.join(BASE_DIR, 'home', 'templates')),
    FileSystemLoader(os.path.join(BASE_DIR, 'tools', 'cmportal', 'templates'))
])

# ===== Static File Routes =====
# Serve home static files
@app.route('/static/home/<path:filename>')
def home_static(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'home', 'static'), filename)

# Serve CMPortal static files
@app.route('/static/cmportal/<path:filename>')
def cmportal_static(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'tools', 'cmportal', 'static'), filename)

# ===== Home Page Routes =====
@app.route('/')
def home():
    """Main landing page"""
    return render_template('main.html')

@app.route('/test')
def test():
    """Test page"""
    return render_template('testcase.html')

# ===== Register Tool Modules =====
# Import and register CMPortal routes
try:
    from tools.cmportal.core.cmportal_routes import register_cmportal_routes
    register_cmportal_routes(app)
    app.logger.info('CMPortal routes registered successfully')
except Exception as e:
    app.logger.error(f'Failed to register CMPortal routes: {e}')
    import traceback
    app.logger.error(traceback.format_exc())

# ===== Application Entry Point =====
if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True)

# you run this file by
# cd ~/palpant-labsite
# source venv/bin/activate
# gunicorn --bind 127.0.0.1:8000 app:app

# Changes to this file require these steps in bash after as they initate app.py:
# pkill gunicorn
# sudo systemctl daemon-reexec
# sudo systemctl daemon-reload
# sudo systemctl start flaskapp
# sudo systemctl enable flaskapp
# sudo systemctl status flaskapp
# sudo systemctl restart nginx

# Changes to other files like html and css require:
# sudo systemctl daemon-reload
# sudo systemctl restart flaskapp
