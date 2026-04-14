Das geht mit einem einzigen Bash-Script. Hier der sauberste Ansatz:**Verwendung auf der OpenStack-Instanz:**

```bash
# 1. Dateien auf den Server kopieren
scp create_accounts.sh students.csv admin@<server-ip>:~

# 2. Script ausführbar machen und starten
chmod +x create_accounts.sh
sudo ./create_accounts.sh students.csv

# 3. ZIP-Dateien herunterladen
scp admin@<server-ip>:~/student_keys/*.zip .
```

------

**Was das Script macht – Schritt für Schritt:**

| Schritt              | Befehl                  | Ergebnis                          |
| -------------------- | ----------------------- | --------------------------------- |
| Konto anlegen        | `useradd --create-home` | Home `/home/e0122d/`              |
| Passwort sperren     | `passwd --lock`         | Nur SSH-Login möglich             |
| Schlüssel generieren | `ssh-keygen -t ed25519` | Kein Passwort auf dem Key         |
| Key eintragen        | `authorized_keys`       | Korrekte Permissions (600/700)    |
| Verpacken            | `zip`                   | `e0122d_ssh.zip` mit Key + README |

**Jeder Student bekommt sein ZIP** mit:

- `id_ed25519` – Private Key
- `id_ed25519.pub` – Public Key
- `README.txt` – fertige SSH-Kommandos für Linux/macOS/Windows (PuTTY + OpenSSH)

**Idempotent:** Wenn das Script ein zweites Mal läuft (z.B. weil jemand nachträglich hinzukommt), werden bestehende Konten übersprungen, neue werden angelegt.

**Sicherheitshinweis:** Die ZIP-Dateien enthalten private Schlüssel – am besten per Moodle als persönliche Einzelabgabe oder per verschlüsselter Mail verteilen, nicht per offenem Link.