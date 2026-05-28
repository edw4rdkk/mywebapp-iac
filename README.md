# Task Tracker — Infrastructure as Code

Лабораторна робота №4. Розгортання Task Tracker на 2 VM за допомогою Terraform та Ansible.

## Варіант

N = 13, V2 = 2 (PostgreSQL, config file), V3 = 2 (Task Tracker), V5 = 4 (port 8000)

## Архітектура

```
+---------VM1 (worker)----------+   +---VM2 (db)---+
client → | nginx → web application | → | PostgreSQL   |
+-------------------------------+   +--------------+
```

- **worker (VM1):** nginx (0.0.0.0:80) + Task Tracker (127.0.0.1:8000)
- **db (VM2):** PostgreSQL (0.0.0.0:5432, доступ обмежений через pg_hba.conf)

## Terraform

Terraform файли описують створення 2 VM (worker + db) через VirtualBox провайдер з cloud-init для базового налаштування (SSH-ключ, користувач ansible).

```bash
cd terraform
terraform init
terraform apply
```

Файли:

- `terraform/main.tf` — опис інфраструктури (2 VM, мережа, cloud-init)
- `terraform/cloud-init/worker.yml` — cloud-init для worker VM
- `terraform/cloud-init/db.yml` — cloud-init для db VM

## Ansible

### Передумови

- Машина з встановленим Ansible (Ubuntu Server)
- SSH-доступ без пароля до обох VM
- Python3 на цільових VM

### Inventory

Файл `ansible/inventory.ini` містить IP-адреси VM:

```ini
[workers]
worker ansible_host=<WORKER_IP> ansible_user=jcm

[db]
db ansible_host=<DB_IP> ansible_user=ansible
```

Замініть `<WORKER_IP>` та `<DB_IP>` на реальні IP-адреси ваших VM.

### Запуск

```bash
cd ansible
ansible-playbook -i inventory.ini playbook.yml
```

Повторний запуск безпечний (ідемпотентний) — якщо конфігурація вже відповідає опису, зміни не вносяться.

### Ролі

| Роль     | Хости   | Опис                                                                                               |
| -------- | ------- | -------------------------------------------------------------------------------------------------- |
| common   | всі     | Створення користувачів (teacher)                                                                   |
| database | db      | PostgreSQL: встановлення, створення БД і користувача, відкриття доступу для worker                 |
| app      | workers | Node.js 20, Task Tracker, systemd-сервіс, конфігурація через template, operator sudoers, gradebook |
| nginx    | workers | Nginx reverse proxy, конфігурація через template, проксує `/` та `/tasks`, блокує `/health`        |

### Templates (динамічна підстановка)

- `config.json.j2` — IP-адреса БД підставляється з inventory: `{{ hostvars['db']['ansible_host'] }}`
- `mywebapp.conf.j2` — nginx конфігурація
- `mywebapp.service.j2` — systemd unit

### Користувачі

| Користувач | VM     | Права                                                                        |
| ---------- | ------ | ---------------------------------------------------------------------------- |
| ansible    | всі    | sudo без пароля (для автоматизації через Ansible)                            |
| teacher    | всі    | sudo з паролем (пароль: 12345678)                                            |
| app        | worker | системний користувач, запускає застосунок                                    |
| operator   | worker | обмежений sudo: start/stop/restart mywebapp, reload nginx (пароль: 12345678) |
| student    | worker | домашня директорія з файлом gradebook (N=13)                                 |

### Перевірка розгортання

```bash
# Health check (напряму до застосунку)
curl http://<WORKER_IP>:8000/health/alive    # 200 OK
curl http://<WORKER_IP>:8000/health/ready    # 200 OK (підключення до БД на VM2)

# API через nginx
curl http://<WORKER_IP>/                      # HTML зі списком ендпоінтів
curl http://<WORKER_IP>/tasks                 # список задач
curl -X POST http://<WORKER_IP>/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"test"}'                       # створити задачу

# Nginx блокує health ззовні
curl http://<WORKER_IP>/health/alive          # 404 Not Found

# Перевірка gradebook
ssh student@<WORKER_IP> "cat ~/gradebook"     # 13

# Перевірка operator
ssh operator@<WORKER_IP>
sudo systemctl status mywebapp.service        # працює
sudo systemctl restart mywebapp.service       # працює
sudo apt update                               # заборонено
```
