pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        exclusiveContent {
            forRepository { mavenCentral() }
            filter { includeGroup("io.github.webrtc-sdk") }
        }
        google()
        mavenCentral()
    }
}

rootProject.name = "NovaAndroid"
include(":app")
