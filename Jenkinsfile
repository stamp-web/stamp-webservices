pipeline {
    agent any

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
				sh '''
					mkdir -p config
					cp testConfigForStampWeb config/application.json
				'''
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