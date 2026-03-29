FROM tomcat:9-jdk11
COPY tomcat-users.xml /usr/local/tomcat/conf/tomcat-users.xml
# Allow Manager access from any IP (lab-only)
RUN sed -i 's/allow="127\\.\\d+\\.\\d+\\.\\d+/allow="\\d+\\.\\d+\\.\\d+\\.\\d+/' \
    /usr/local/tomcat/webapps/manager/META-INF/context.xml 2>/dev/null || true
# Ensure default webapps are deployed
RUN cp -r /usr/local/tomcat/webapps.dist/* /usr/local/tomcat/webapps/ 2>/dev/null || true
EXPOSE 8080
