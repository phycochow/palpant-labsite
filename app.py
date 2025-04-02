from flask import Flask, render_template
import database

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('main.html')

@app.route('/cmportal')
def cmportal():
    return render_template('cmportal.html')

@app.route('/dash')
def dash():
    return render_template('dashboard.html')


# API endpoints for AJAX calls
@app.route('/api/viewer')
def api_viewer():
    df = database.get_data()
    return jsonify(df.to_dict(orient='records'))

@app.route('/api/enrichment')
def api_enrichment():
    df = database.get_data()
    return jsonify(df.to_dict(orient='records'))

@app.route('/api/search')
def api_search():
    df = database.get_data()
    return jsonify(df.to_dict(orient='records'))

if __name__ == '__main__':
    # Development server only – not used in production
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

# Changes to other files like html and css require:
# sudo systemctl daemon-reload
# sudo systemctl restart flaskapp