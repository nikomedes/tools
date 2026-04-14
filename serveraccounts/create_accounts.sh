#!/usr/bin/env bash
# =============================================================================
# create_accounts.sh
# Legt Benutzerkonten auf einem Debian-Server an, generiert SSH-Schlüsselpaare
# und trägt die Public Keys als authorized_keys ein.
#
# Verwendung:
#   sudo ./create_accounts.sh [--keys-dir <verzeichnis>] <students.csv>
#
# Format students.csv (eine Zeile pro Student, Kommentar mit #):
#   username,Vorname Nachname
#   e0122d,Max Mustermann
#   e0133f,Anna Beispiel
#
# Ergebnis:
#   - Benutzerkonto mit Home-Verzeichnis angelegt
#   - SSH-Schlüsselpaar generiert (Ed25519)
#   - Public Key in ~/.ssh/authorized_keys eingetragen
#   - Private Keys gesammelt in <keys-dir>/<username>/
#     → pro Student eine .zip-Datei zur Weitergabe
#
# Helmut Lindner | Institut für Software Design und Security | SS 2026
# =============================================================================

set -euo pipefail

# ── Konfiguration ─────────────────────────────────────────────────────────────

KEYS_DIR="./student_keys"      # Ausgabeverzeichnis für private Schlüssel
KEY_TYPE="ed25519"             # Schlüsseltyp (ed25519 = modern, klein, sicher)
KEY_COMMENT_PREFIX="starfleet" # Kommentar im Public Key

# ── Farben für die Ausgabe ─────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Argumente parsen ──────────────────────────────────────────────────────────

usage() {
    echo "Verwendung: sudo $0 [--keys-dir <verzeichnis>] <students.csv>"
    echo ""
    echo "  students.csv  – CSV-Datei: username,Vorname Nachname"
    echo "  --keys-dir    – Ausgabeverzeichnis (Standard: ./student_keys)"
    exit 1
}

CSV_FILE=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --keys-dir) KEYS_DIR="$2"; shift 2 ;;
        --help|-h)  usage ;;
        *)          CSV_FILE="$1"; shift ;;
    esac
done

[[ -z "$CSV_FILE" ]] && usage
[[ ! -f "$CSV_FILE" ]] && { log_error "Datei nicht gefunden: $CSV_FILE"; exit 1; }

# ── Root-Check ────────────────────────────────────────────────────────────────

if [[ $EUID -ne 0 ]]; then
    log_error "Dieses Script muss als root ausgeführt werden (sudo)."
    exit 1
fi

# ── Voraussetzungen prüfen ────────────────────────────────────────────────────

for cmd in useradd ssh-keygen zip; do
    if ! command -v "$cmd" &>/dev/null; then
        log_error "Benötigtes Programm nicht gefunden: $cmd"
        [[ "$cmd" == "zip" ]] && log_info "Installation: apt install zip"
        exit 1
    fi
done

# ── Ausgabeverzeichnis vorbereiten ────────────────────────────────────────────

mkdir -p "$KEYS_DIR"
chmod 700 "$KEYS_DIR"

# Zusammenfassungs-Datei
SUMMARY="$KEYS_DIR/accounts_summary.txt"
{
    echo "Starfleet Battle – SSH Accounts"
    echo "Erstellt: $(date '+%Y-%m-%d %H:%M')"
    echo "Server:   $(hostname -f 2>/dev/null || hostname)"
    echo "========================================"
} > "$SUMMARY"

# ── Statistiken ───────────────────────────────────────────────────────────────

COUNT_OK=0
COUNT_SKIP=0
COUNT_ERR=0

# ── Hauptschleife ─────────────────────────────────────────────────────────────

echo ""
log_info "Verarbeite $CSV_FILE ..."
echo ""

while IFS=',' read -r username fullname; do

    # Leerzeichen trimmen, Kommentare und Leerzeilen überspringen
    username="${username// /}"
    fullname="${fullname#"${fullname%%[![:space:]]*}"}"  # führende Spaces
    fullname="${fullname%"${fullname##*[![:space:]]}"}"  # nachfolgende Spaces

    [[ -z "$username" || "$username" == \#* ]] && continue

    echo "────────────────────────────────────────"
    log_info "Benutzer: $username  ($fullname)"

    # ── Benutzerkonto anlegen ──────────────────────────────────────────────

    if id "$username" &>/dev/null; then
        log_warn "Benutzer '$username' existiert bereits – übersprungen."
        echo "  $username ($fullname) – bereits vorhanden" >> "$SUMMARY"
        COUNT_SKIP=$((COUNT_SKIP + 1))
        continue
    fi

    if ! useradd \
            --create-home \
            --shell /bin/bash \
            --comment "$fullname" \
            "$username"; then
        log_error "useradd für '$username' fehlgeschlagen."
        COUNT_ERR=$((COUNT_ERR + 1))
        continue
    fi

    # Passwort-Login deaktivieren (nur SSH-Key-Authentifizierung)
    passwd --lock "$username" &>/dev/null
    log_ok "Konto '$username' angelegt, Passwort-Login deaktiviert."

    # ── SSH-Verzeichnis vorbereiten ────────────────────────────────────────

    USER_HOME=$(getent passwd "$username" | cut -d: -f6)
    SSH_DIR="$USER_HOME/.ssh"

    mkdir -p "$SSH_DIR"
    chmod 700 "$SSH_DIR"
    chown "$username:$username" "$SSH_DIR"

    # ── Schlüsselpaar generieren ───────────────────────────────────────────

    KEY_FILE="$SSH_DIR/id_$KEY_TYPE"
    KEY_COMMENT="${KEY_COMMENT_PREFIX}@${username}"

    ssh-keygen \
        -t "$KEY_TYPE" \
        -C "$KEY_COMMENT" \
        -f "$KEY_FILE" \
        -N "" \          # kein Passwort auf dem Private Key
        -q               # keine Ausgabe

    chown "$username:$username" "$KEY_FILE" "${KEY_FILE}.pub"
    chmod 600 "$KEY_FILE"
    chmod 644 "${KEY_FILE}.pub"

    log_ok "Schlüsselpaar generiert: $KEY_FILE"

    # ── Public Key eintragen ───────────────────────────────────────────────

    AUTH_KEYS="$SSH_DIR/authorized_keys"
    cat "${KEY_FILE}.pub" >> "$AUTH_KEYS"
    chown "$username:$username" "$AUTH_KEYS"
    chmod 600 "$AUTH_KEYS"

    log_ok "Public Key in authorized_keys eingetragen."

    # ── Private Key für Weitergabe verpacken ───────────────────────────────

    DIST_DIR="$KEYS_DIR/$username"
    mkdir -p "$DIST_DIR"

    # Private Key kopieren
    cp "$KEY_FILE" "$DIST_DIR/id_${KEY_TYPE}"
    chmod 600 "$DIST_DIR/id_${KEY_TYPE}"

    # Public Key kopieren (nützlich für Studenten, die den Key woanders nutzen)
    cp "${KEY_FILE}.pub" "$DIST_DIR/id_${KEY_TYPE}.pub"

    # Verbindungs-Anleitung als README
    SERVER_IP=$(hostname -I | awk '{print $1}')
    cat > "$DIST_DIR/README.txt" << EOF
Starfleet Battle – SSH Zugangsdaten
====================================
Benutzer:  $username
Name:      $fullname
Server:    $SERVER_IP

Verbindung herstellen
─────────────────────
Linux / macOS:
  chmod 600 id_${KEY_TYPE}
  ssh -i id_${KEY_TYPE} ${username}@${SERVER_IP}

Windows (PuTTY):
  1. PuTTYgen öffnen → "Load" → id_${KEY_TYPE} laden
  2. "Save private key" → als .ppk speichern
  3. PuTTY → Host: ${SERVER_IP}, User: ${username}
     Connection > SSH > Auth > Private key file: .ppk

Windows (OpenSSH in PowerShell):
  ssh -i id_${KEY_TYPE} ${username}@${SERVER_IP}

Client starten
──────────────
  ./client ${SERVER_IP} 8888
EOF

    # ZIP-Archiv erstellen
    ZIP_FILE="$KEYS_DIR/${username}_ssh.zip"
    (cd "$DIST_DIR" && zip -q "../${username}_ssh.zip" .)
    log_ok "ZIP erstellt: ${username}_ssh.zip"

    # Zusammenfassung ergänzen
    {
        echo ""
        echo "Benutzer:    $username"
        echo "Name:        $fullname"
        echo "Home:        $USER_HOME"
        echo "Public Key:  $(cat "${KEY_FILE}.pub")"
        echo "ZIP:         ${username}_ssh.zip"
    } >> "$SUMMARY"

    COUNT_OK=$((COUNT_OK + 1))

done < "$CSV_FILE"

# ── Abschlussbericht ──────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════"
log_info "Fertig."
log_ok   "Angelegt:     $COUNT_OK"
[[ $COUNT_SKIP -gt 0 ]] && log_warn "Übersprungen: $COUNT_SKIP (bereits vorhanden)"
[[ $COUNT_ERR  -gt 0 ]] && log_error "Fehler:       $COUNT_ERR"
echo ""
log_info "Private Keys und ZIPs: $KEYS_DIR/"
log_info "Zusammenfassung:       $SUMMARY"
echo ""
log_warn "Die ZIP-Dateien enthalten private Schlüssel – sicher übertragen!"
log_info "Empfehlung: per verschlüsselter E-Mail oder Moodle (Einzelabgabe)."
echo ""
