"""
Dashboard Routes Module
Handles base dashboard functionality and routing
"""

from flask import render_template

def register_dashboard_routes(app):
    """
    Register dashboard base routes with the Flask app
    """
    
    @app.route('/dashboard')
    def dashboard_home():
        """Dashboard landing page - shows available tools"""
        return render_template('dashboard.html')
    
    app.logger.info('Dashboard base routes registered')
