FROM ubuntu

RUN apt-get update; apt-get install -y software-properties-common nginx vim telnet
RUN add-apt-repository -y ppa:ethereum/ethereum; apt-get update; apt-get install -y ethereum 
RUN mkdir -p /etc/nginx/ssl
COPY rev-proxy.conf /etc/nginx/sites-available/
RUN ln -s /etc/nginx/sites-available/rev-proxy.conf /etc/nginx/sites-enabled/rev-proxy.conf
COPY cert.key cert.pem /etc/nginx/ssl
RUN touch /etc/nginx/ssl/client.pem

CMD sleep infinity

