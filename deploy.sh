#!/bin/bash
set -e

PROJECT="/projec-panela"
PORT=3001

echo "=== 1. BUILD PRODUÇÃO ==="
cd $PROJECT
npm run build

echo ""
echo "=== 2. INICIAR SERVIDOR (produção) ==="
pkill -f "next-server" 2>/dev/null || true
sleep 1
nohup npm start -- -p $PORT > /tmp/server.log 2>&1 &
SPID=$!
echo "Server PID: $SPID"

echo ""
echo "=== 3. AGUARDAR SERVIDOR ==="
for i in $(seq 1 15); do
  if curl -sf http://localhost:$PORT/login >/dev/null 2>&1; then
    echo "✅ Servidor pronto na porta $PORT"
    break
  fi
  echo "Aguardando servidor ($i)..."
  sleep 2
done

echo ""
echo "=== 4. INICIAR TÚNEL (com reconexão automática) ==="
pkill -f "ssh.*localhost.run" 2>/dev/null || true
sleep 1

# Tunnel com loop infinito de reconexão
cat > /tmp/tunnel_loop.sh << 'LOOPEOF'
#!/bin/bash
while true; do
  echo "[$(date)] Conectando tunnel..."
  ssh -o StrictHostKeyChecking=no \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes \
      -o ConnectTimeout=10 \
      -R 80:localhost:3001 nokey@localhost.run 2>&1 | tee -a /tmp/tunnel.log
  echo "[$(date)] Tunnel caiu. Reconectando em 5s..."
  sleep 5
done
LOOPEOF
chmod +x /tmp/tunnel_loop.sh
nohup /tmp/tunnel_loop.sh > /tmp/tunnel_daemon.log 2>&1 &
TPID=$!
echo "Tunnel PID: $TPID"

echo ""
echo "=== 5. INICIAR HEALTHCHECK ==="
cat > /tmp/healthcheck.sh << 'HEALTHEOF'
#!/bin/bash
while true; do
  # Verifica servidor
  if ! curl -sf http://localhost:3001/login >/dev/null 2>&1; then
    echo "[$(date)] SERVER MORTO! Reiniciando..." >> /tmp/healthcheck.log
    cd /projec-panela
    nohup npm start -- -p 3001 > /tmp/server.log 2>&1 &
  fi
  # Verifica tunnel
  if ! pgrep -f "ssh.*localhost.run" >/dev/null 2>&1; then
    echo "[$(date)] TUNNEL MORTO! Reiniciando..." >> /tmp/healthcheck.log
    nohup /tmp/tunnel_loop.sh > /tmp/tunnel_daemon.log 2>&1 &
  fi
  sleep 30
done
HEALTHEOF
chmod +x /tmp/healthcheck.sh
nohup /tmp/healthcheck.sh > /tmp/healthcheck.log 2>&1 &
HPID=$!
echo "Healthcheck PID: $HPID"

echo ""
echo "=== 6. AGUARDAR TÚNEL ==="
sleep 15
URL=$(grep -oP 'https://[a-zA-Z0-9.-]+\.lhr\.life' /tmp/tunnel.log 2>/dev/null | tail -1)
echo "URL: $URL"

echo ""
echo "=== 7. VERIFICAR ==="
echo "Server: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT/login)"
echo "Tunnel: $(curl -s -o /dev/null -w '%{http_code}' --max-time 8 \"$URL/login\" 2>/dev/null)"
echo ""
echo "✅ Link: $URL"

echo ""
echo "=== 8. NOTIFICAR TELEGRAM ==="
TOKEN_TG=$(grep '^TELEGRAM_BOT_TOKEN=' $PROJECT/.env.local 2>/dev/null | cut -d= -f2-)
CHAT_ID_TG=$(grep '^TELEGRAM_CHAT_ID=' $PROJECT/.env.local 2>/dev/null | cut -d= -f2-)
if [ -n "$TOKEN_TG" ] && [ -n "$CHAT_ID_TG" ]; then
  MSG="<b>🔔 Panela da Roça — app atualizado</b>
✅ Novo link: $URL
🕓 $(date '+%d/%m/%Y %H:%M')"
  RES=$(curl -s -X POST "https://api.telegram.org/bot${TOKEN_TG}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\":\"${CHAT_ID_TG}\",\"text\":\"$(echo "$MSG" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')\",\"parse_mode\":\"HTML\"}")
  echo "Telegram: $(echo "$RES" | grep -o '"ok":[a-z]*' | head -1)"
else
  echo "Telegram nao configurado (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no .env.local)"
fi