@echo off
set DIR=%~dp0
if not "%JAVA_HOME%"=="" (set JAVA_EXE=%JAVA_HOME%\bin\java.exe) else (set JAVA_EXE=java.exe)
if not exist "%DIR%gradle\wrapper\gradle-wrapper.jar" (
  echo Missing Gradle Wrapper JAR for Gradle 8.9 1>&2
  exit /b 1
)
"%JAVA_EXE%" -classpath "%DIR%gradle\wrapper\gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain %*
