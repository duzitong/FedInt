FROM ubuntu

RUN apt-get update; apt-get install -y software-properties-common nginx vim telnet mongodb curl
RUN curl -sL https://deb.nodesource.com/setup_9.x | bash -
RUN apt-get install -y nodejs git build-essential
RUN add-apt-repository -y ppa:ethereum/ethereum; apt-get update; apt-get install -y ethereum
RUN mkdir -p /etc/nginx/ssl /app
COPY rev-proxy.conf /etc/nginx/sites-available/
RUN ln -s /etc/nginx/sites-available/rev-proxy.conf /etc/nginx/sites-enabled/rev-proxy.conf
COPY cert.key cert.pem /etc/nginx/ssl/
RUN touch /etc/nginx/ssl/client.pem
RUN cd /app/; npm install mongo web3 pem
COPY abi.json app.js /app/
RUN chsh -s /bin/bash

CMD sleep infinity

