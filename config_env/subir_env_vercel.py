"""
Sube las variables de .env a Vercel via API REST.
Uso: python config_env/subir_env_vercel.py
"""
import os, json, sys
import urllib.request, urllib.error

BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE  = os.path.join(BASE_DIR, ".env")
REPO_FILE = os.path.join(BASE_DIR, ".vercel", "repo.json")

def leer_env(path):
    variables = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            variables[key.strip()] = value.strip().strip('"').strip("'")
    return variables

def leer_project_id(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data["projects"][0]["id"]

def subir(token, project_id, key, value):
    url = f"https://api.vercel.com/v10/projects/{project_id}/env"
    payload = json.dumps({
        "key": key, "value": value,
        "type": "encrypted",
        "target": ["production", "preview", "development"]
    }).encode()
    req = urllib.request.Request(url, data=payload, method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return True, r.status
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if "ENV_ALREADY_EXISTS" in body or "already exists" in body:
            return True, "ya existe"
        return False, body[:100]

def main():
    print("=" * 52)
    print("  Subir variables .env → Vercel")
    print("=" * 52)
    token = input("\nToken (vercel.com/account/tokens): ").strip()
    if not token:
        print("Token vacío."); return
    project_id = leer_project_id(REPO_FILE)
    print(f"Proyecto: {project_id}")
    variables = leer_env(ENV_FILE)
    print(f"Variables: {len(variables)}\n")
    ok = err = 0
    for key, value in variables.items():
        success, status = subir(token, project_id, key, value)
        print(f"  {'✓' if success else '✗'} {key}: {status}")
        if success: ok += 1
        else: err += 1
    print(f"\n→ {ok} subidas, {err} errores")
    if err == 0:
        print("Listo. Haz un nuevo deploy en Vercel para que tomen efecto.")

if __name__ == "__main__":
    main()
