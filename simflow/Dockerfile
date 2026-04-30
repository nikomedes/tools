FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html      /usr/share/nginx/html/
COPY simflow.js      /usr/share/nginx/html/
COPY engine/         /usr/share/nginx/html/engine/
COPY examples/       /usr/share/nginx/html/examples/
