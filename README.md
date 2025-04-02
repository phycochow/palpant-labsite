#### Note to self
# Run these code line by line to deploy a Flask website on AWS Lightsail (Ubuntu 24.04 LTS)

---

## Step 1 – Update the System
```bash
sudo apt update
sudo apt upgrade -y
```

---

## Step 2 – Install Required Software
### System packages
```bash
sudo apt install -y python3 python3-pip python3-venv nginx
```

---

## Step 3 – Set Up Your Python Environment
### Create project directory
```bash
mkdir -p ~/home/ubuntu/palpant-labsite
cd ~/home/ubuntu/palpant-labsite
```

### Create and activate a virtual environment
```bash
python3 -m venv venv
source venv/bin/activate
```

### Install Python packages in your virtual environment
```bash
pip install flask gunicorn
```

---

## Step 4 – Create Project File Structure and Retrieve from GitHub
```bash
mkdir -p ~/home/ubuntu/palpant-labsite/templates ~/home/ubuntu/palpant-labsite/static/css
```
- Create `app.py` with Flask code
- Create `index.html`, `about.html` under `templates/`
- Create `style.css` under `static/css/`
- Create `flaskapp` which contains the web domain
- Create `flaskapp.service`

OR
```bash
git pull
```

---
## Step 5 – Test Python Code
```bash
cd ~/home/ubuntu/palpant-labsite/
source venv/bin/activate
python app.py
```
Browser paste: http://{Iv4 public IP found in LightSail instance page}:8000/

---

## Step 5 – Run and Test Flask App with Gunicorn
### Manual test:
```bash
cd ~/home/ubuntu/palpant-labsite
source venv/bin/activate
gunicorn --bind 127.0.0.1:8000 app:app
```
Visit `http://<your-public-ip>` after setting up Nginx.

---

## Step 6 – Configure Nginx as a Reverse Proxy
### Create config file:
```bash
sudo vi /etc/nginx/sites-available/flaskapp
```
Add reverse proxy pointing to `127.0.0.1:8000`.

### Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/flaskapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 7 – Create `systemd` Service for Gunicorn
```bash
sudo nano /etc/systemd/system/flaskapp.service
```
Use service content with:
- `User=ubuntu`
- `WorkingDirectory=/home/ubuntu/palpant-labsite`
- `ExecStart=/home/ubuntu/palpant-labsite/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:8000 app:app`

### Reload and enable service:
```bash
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl start flaskapp
sudo systemctl enable flaskapp
sudo systemctl status flaskapp
```

check
sudo systemctl status flaskapp


---

## Step 8 – Test Deployment
### Kill any manual Gunicorn instance:
```bash
pkill gunicorn
```
### Reboot to confirm service runs on boot:
```bash
sudo reboot
```
If this is bugged due to LightSail security concerns, just restart the terminal and verify at:
```http
http://<your-public-ip>
```

---
## Step 9 – Add HTTPS web domain
---

Go back to step 4 to change web domain

### Install Certbot for HTTPS
```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

Request and Install SSL Certificate
```bash
sudo certbot --nginx -d palpantlab.duckdns.org
```
Follow the prompts:
- Accept Terms
- Provide email
- Certbot auto-configures Nginx with SSL

Then update the public IP with the web domain, e.g. palpantlab.duckdns.org
```bash
sudo vi /etc/nginx/sites-available/flaskapp
sudo rm /etc/nginx/sites-enabled/flaskapp
sudo ln -s /etc/nginx/sites-available/flaskapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Visit your site:
```https
https://palpantlab.duckdns.org
```
It should load securely with a lock icon.

---

```bash
sudo certbot renew --dry-run
```
Certbot sets up a cron job for auto-renewal every 60 days.

---
check if Gunicorn Still Running?

ps aux | grep gunicorn

restart with
pkill gunicorn


cd ~/palpant-labsite
source venv/bin/activate
gunicorn --bind 127.0.0.1:8000 app:app

sudo rm /etc/nginx/sites-enabled/default
---

✅ All done! You now have a Flask app deployed with Nginx + Gunicorn on Lightsail.

---
Changed html code

git pull
sudo systemctl daemon-reload
sudo systemctl restart flaskapp

---
difficulty loading css - 403 error

sudo chmod -R 755 /home/ubuntu/palpant-labsite/static
sudo chmod 755 /home/ubuntu
sudo chmod 755 /home/ubuntu/palpant-labsite

---
website not working in a sudden

cat /etc/nginx/sites-enabled/default
the website is hosted with Gunicorn, Flask, nginx on lightsail