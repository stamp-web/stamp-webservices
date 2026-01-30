pipeline {
    agent any

    parameters {
        credentials(name: 'CONFIG_FILE_CRED', defaultValue: '', description: 'Secret file for environment config')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/master']],
                    userRemoteConfigs: [[
                        url: 'https://github.com/stamp-web/stamp-webservices.git',
                        credentialsId: 'jadrake-github'
                    ]]
                ])
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Apply Environment Config') {
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

        stage('Stamp Build Number') {
            steps {
                sh '''
                    echo "{\"buildTime\": ${BUILD_ID}}" > www/build-number.json
                '''
            }
        }

        stage('Unit Tests') {
            environment {
                port = '9008'
            }
            steps {
                sh 'npx jest --runInBand --testTimeout 30000'
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: '**/junit*.xml'
                }
            }
        }

        stage('Bundle Dependencies') {
            steps {
                sh 'npx bundle-deps .'
            }
        }

        stage('Package') {
            steps {
                sh 'npm pack'
            }
        }
    }

    post {
        success {
            archiveArtifacts artifacts: '*.tgz', fingerprint: true
        }
    }
}