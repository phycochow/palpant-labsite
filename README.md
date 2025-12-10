# Palpant Lab Website

Flask-based website for Palpant Lab featuring CMPortal research dashboard.

---

## Project Structure

```
palpant-labsite/
│
├── core/
│   ├── app.py                      # Flask app entrypoint
│   ├── flaskapp                    # Nginx config
│   └── flaskapp.service            # Systemd service config
│
├── home/
│   ├── templates/
│   │   ├── main.html               # Landing page
│   │   └── testcase.html           # Test page
│   └── static/
│       ├── css/
│       │   └── main.css            # Homepage styling
│       └── js/
│           └── (empty)             # Placeholder for future JS
│
├── tools/
│   └── cmportal/
│       ├── templates/
│       │   ├── cmportal.html       # Main CMPortal page
│       │   ├── dashboard.html      # Base dashboard layout
│       │   └── tabs/
│       │       ├── tab-video.html
│       │       ├── tab-viewer.html
│       │       ├── tab-search.html
│       │       ├── tab-enrichment.html
│       │       └── tab-benchmark.html
│       │
│       ├── static/
│       │   ├── css/
│       │   │   ├── cmportal.css
│       │   │   ├── dashboard.css
│       │   │   ├── tab-search.css
│       │   │   ├── tab-enrichment.css
│       │   │   ├── tab-benchmark.css
│       │   │   ├── tab-viewer.css
│       │   │   └── tab-video.css
│       │   ├── js/
│       │   │   ├── cmportal-base.js
│       │   │   ├── tab-search.js
│       │   │   ├── tab-enrichment.js
│       │   │   ├── tab-viewer.js
│       │   │   ├── tab-benchmark.js
│       │   │   └── tab-benchmark-radar.js
│       │   └── datasets/
│       │       ├── 0_TargetParameters_12Apr25.csv
│       │       ├── 0_FeatureCategories_01Mar25.csv
│       │       ├── 0_CausalFeatureCategories_04Mar25.csv
│       │       ├── 1_PermutatedImportancesTRUE_02May25.csv
│       │       ├── 0_CleanedDatabase_25Feb25.csv
│       │       ├── 1_BinaryFeatures_25Feb25.csv
│       │       └── 1_PositiveOddsEnrichments_03May25.csv
│       │
│       └── core/
│           ├── cmportal_routes.py       # Route definitions
│           ├── cmportal_config.py       # CMPortal configuration
│           ├── cmportal_data_manager.py # Data pipeline/caching
│           ├── cmportal_utils.py        # Helper functions
│           └── uploads/                 # Temporary file staging (gitignored)
│
├── venv/                           # Python virtual environment (gitignored)
│
├── .gitignore
└── README.md
```

---

## Architecture

### Modular Design
- **`core/`**: Global Flask infrastructure (app entrypoint, configs)
- **`home/`**: Landing page assets (templates + static files)
- **`tools/cmportal/`**: Self-contained CMPortal research dashboard
  - Each tool is modular and portable
  - Future tools follow same pattern: `tools/newtool/`

### Request Flow
1. Nginx receives request on port 80/443
2. Proxies to Gunicorn on 127.0.0.1:8000
3. Flask app routes to appropriate module
4. Static files served directly by Nginx (bypassing Flask)

---

## Deployment Guide (AWS Lightsail - Ubuntu 24.04 LTS)

### Step 1 – Update System
```bash
sudo apt update
sudo apt upgrade -y
```

---

### Step 2 – Install Required Software
```bash
sudo apt install -y python3 python3-pip python3-venv nginx git
```

---

### Step 3 – Clone Repository
```bash
cd /home/ubuntu
git clone https://github.com/phycochow/palpant-labsite.git
cd palpant-labsite
```

---

### Step 4 – Set Up Python Environment
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install flask gunicorn pandas numpy PyPDF2
```

---

### Step 5 – Test Application Locally
```bash
cd core
python app.py
```
Visit: `http://<your-lightsail-ip>:5000`

Press `Ctrl+C` to stop.

---

### Step 6 – Configure Systemd Service
```bash
# Copy service file
sudo cp core/flaskapp.service /etc/systemd/system/flaskapp.service

# Reload systemd and start service
sudo systemctl daemon-reload
sudo systemctl start flaskapp
sudo systemctl enable flaskapp

# Check status
sudo systemctl status flaskapp
```

---

### Step 7 – Configure Nginx
```bash
# Remove default config
sudo rm /etc/nginx/sites-enabled/default

# Copy new config
sudo cp core/flaskapp /etc/nginx/sites-available/flaskapp
sudo ln -s /etc/nginx/sites-available/flaskapp /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

---

### Step 8 – Configure Firewall
```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
sudo ufw status
```

---

### Step 9 – Set Up Swap (Recommended for small instances)
```bash
sudo fallocate -l 512M /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

### Step 10 – SSL Certificate with Let's Encrypt
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate (replace with your domain)
sudo certbot --nginx -d palpantlab.com

# Test auto-renewal
sudo certbot renew --dry-run
```

Certificates auto-renew every 60 days.

---

### Step 11 – Fix File Permissions
```bash
sudo chmod -R 755 /home/ubuntu/palpant-labsite/home/static
sudo chmod -R 755 /home/ubuntu/palpant-labsite/tools/cmportal/static
sudo chmod 755 /home/ubuntu
sudo chmod 755 /home/ubuntu/palpant-labsite
```

---

## Maintenance Commands

### Update Code from GitHub
```bash
cd /home/ubuntu/palpant-labsite
git pull
sudo systemctl restart flaskapp
```

### View Logs
```bash
# Application logs
sudo journalctl -u flaskapp -f

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Restart Services
```bash
# Restart Flask app
sudo systemctl restart flaskapp

# Restart Nginx
sudo systemctl restart nginx

# Reload systemd after config changes
sudo systemctl daemon-reload
```

### Check Service Status
```bash
sudo systemctl status flaskapp
sudo systemctl status nginx
```

### Manual Gunicorn Test
```bash
cd /home/ubuntu/palpant-labsite/core
source ../venv/bin/activate
gunicorn --bind 127.0.0.1:8000 app:app
```

---

## Troubleshooting

### 502 Bad Gateway
```bash
# Check if Flask app is running
sudo systemctl status flaskapp

# Check logs
sudo journalctl -u flaskapp -n 50

# Restart
sudo systemctl restart flaskapp
```

### 403 Forbidden (Static Files)
```bash
# Fix static file permissions
sudo chmod -R 755 /home/ubuntu/palpant-labsite/home/static
sudo chmod -R 755 /home/ubuntu/palpant-labsite/tools/cmportal/static
sudo chmod 755 /home/ubuntu
sudo chmod 755 /home/ubuntu/palpant-labsite
```

### Service Won't Start
```bash
# Check working directory exists
ls -la /home/ubuntu/palpant-labsite/core

# Verify virtual environment
ls -la /home/ubuntu/palpant-labsite/venv/bin

# Test manually
cd /home/ubuntu/palpant-labsite/core
source ../venv/bin/activate
python app.py
```

### Import Errors
```bash
# Ensure you're in the correct directory
cd /home/ubuntu/palpant-labsite/core

# Check Python path
source ../venv/bin/activate
python -c "import sys; print(sys.path)"
```

### Template Not Found
```bash
# Verify template directories exist
ls -la /home/ubuntu/palpant-labsite/home/templates
ls -la /home/ubuntu/palpant-labsite/tools/cmportal/templates

# Check ChoiceLoader configuration in core/app.py
```

---

## Development Notes

### Key Paths
- **Working directory:** `/home/ubuntu/palpant-labsite/core`
- **Flask runs on:** `127.0.0.1:8000`
- **Nginx proxies:** `80/443` → `8000`
- **Static files:** Served directly by Nginx
- **Uploads:** Cleaned automatically every 20 minutes

### URL Routes
- **Homepage:** `https://palpantlab.com/`
- **CMPortal Dashboard:** `https://palpantlab.com/cmportal`
- **Test Page:** `https://palpantlab.com/test`

### Adding New Tools
1. Create new directory: `tools/newtool/`
2. Follow CMPortal structure:
   - `core/` (Python logic)
   - `templates/` (HTML)
   - `static/` (CSS/JS/data)
3. Create `newtool_routes.py` with `register_newtool_routes(app)` function
4. Import and register in `core/app.py`
5. Add static file route in `core/app.py`
6. Add Nginx location block in `core/flaskapp`

---

## Technologies

- **Backend:** Flask, Gunicorn
- **Web Server:** Nginx
- **Data Processing:** Pandas, NumPy
- **PDF Parsing:** PyPDF2
- **Frontend:** Vanilla JS, jQuery, DataTables
- **Charts:** Chart.js
- **Deployment:** Systemd, Let's Encrypt
- **Platform:** AWS Lightsail (Ubuntu 24.04 LTS)

---

## Security

- HTTPS enforced via Let's Encrypt
- File upload size limited to 5MB
- Temporary files auto-cleaned every 20 minutes
- Static files cached for 2 days
- Firewall configured (UFW)

---

## License

© 2025 Palpant Lab. All rights reserved.

---

## Contact

For issues or questions, contact chris.chow@uq.edu.au