#!/bin/sh
#
# Gradle start-up script for POSIX generated for Natural Reader.
#

die () {
    echo "$*"
    exit 1
}

APP_HOME=$( cd "${0%/*}" && pwd -P ) || exit

CLASSPATH=$APP_HOME/gradle/wrapper/gradle-wrapper.jar

if [ -n "$JAVA_HOME" ] ; then
    JAVACMD=$JAVA_HOME/bin/java
else
    JAVACMD=java
fi

exec "$JAVACMD" \
  -classpath "$CLASSPATH" \
  org.gradle.wrapper.GradleWrapperMain \
  "$@"
