# Main OS
FROM    centos:centos6

# Set some environment variables to host names of databases based on /etc/hosts.
ENV redis_server=redis
ENV mongodb_server=mongo

# Install Node.js and other dependencies
RUN yum install -y curl
RUN curl -sL https://rpm.nodesource.com/setup | bash -
RUN yum install -y nodejs
RUN yum install -y gcc-c++ make

# Define the working directory and bundle the source.
WORKDIR /src
COPY . /src

# Install app dependencies
RUN cd /src; npm install

# Expose port
EXPOSE  3000

# Run app using npm
CMD ["npm", "start"]