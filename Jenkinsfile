pipeline {
    agent any

    triggers {
        githubPush()
    }

    parameters {
        credentials(name: 'CONFIG_FILE_CRED', defaultValue: 'test-application.json', description: 'Secret file for environment config')
    }

    stages {
        stage('Clean') {
            steps {
                cleanWs()
            }
        }
        stage('Checkout') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/master']],
                    userRemoteConfigs: [[
                        url: 'https://github.com/stamp-web/stamp-webservices.git',
                        credentialsId: 'github'
                    ]]
                ])
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install --omit=dev'
            }
        }

        stage('Environment Config') {
			steps {
				withCredentials([
					file(credentialsId: "${params.CONFIG_FILE_CRED}", variable: 'CFG_FILE')
				]) {
				    sh '''
				    mkdir -p config
					cp "$CFG_FILE" config/application.json
					'''
				}
			}
		}

        stage('Set Build') {
            steps {
                sh '''
                    echo "{\"buildTime\": ${BUILD_ID}}" > www/build-number.json
                '''
            }
        }

        stage('Bundle Dependencies') {
            steps {
                sh 'npx bundle-deps .'
            }
        }

        stage('Package') {
            steps {
                sh '''
                    mkdir -p archive
                    npm pack --pack-destination archive
                '''
            }
        }

        stage('Unit Tests') {
            environment {
                port = '9008'
            }
            steps {
                sh 'npm install && npx jest --runInBand --testTimeout 30000'
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: '**/junit*.xml'
                }
            }
        }

    }

    post {
        success {
            archiveArtifacts artifacts: 'archive/*.tgz', fingerprint: true
        }
    }
}