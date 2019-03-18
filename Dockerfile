FROM zenato/puppeteer

USER root

RUN groupmod -g 988 node
RUN usermod -d /home/node -s /bin/nologin -u 988 -g 988 node
RUN install -onode -gnode -d /home/node
RUN install -onode -gnode -d /opt/app

ADD https://github.com/Yelp/dumb-init/releases/download/v1.2.2/dumb-init_1.2.2_amd64 /usr/local/bin/dumb-init
RUN chmod +x /usr/local/bin/dumb-init

RUN echo "dumb-init node --inspect=0.0.0.0:56745 src/index.js" > /start.sh; chmod +x /start.sh

ARG BUILD_DEV
ARG BUILD_DEV_PORT=56745
RUN if [ -n "$BUILD_DEV" ] ; then npm install -g nodemon; fi
#https://github.com/remy/nodemon#application-isnt-restarting
RUN if [ -n "$BUILD_DEV" ] ; then  echo "dumb-init nodemon -L --verbose --watch /opt/app/src --inspect=0.0.0.0:$BUILD_DEV_PORT src/index.js" > /start.sh; fi

USER node

COPY . /opt/app

RUN cd /opt/app && rm -rf node_modules && npm install --quiet --production

EXPOSE 3000

WORKDIR /opt/app

CMD /start.sh

# docker build -t joelabair/puppeteer .
