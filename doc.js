#!/usr/bin/env groovy

// CICD SB changes
//import groovy.json.*
//@Library('cicd-private')
//import com.att.eg.cicd.*
//import com.att.eg.cicd.utils.*

/* =========================================================================
 * READ BEFORE MODIFYING
 * =========================================================================
 * This file is "owned" by the related generator project. Any changes made
 * here meant for the templates MUST be applied to that file as well.
 *
 * TODO: Add generator file link
 *
 */

properties([[$class: 'ParametersDefinitionProperty', parameterDefinitions: [
    [$class: 'hudson.model.StringParameterDefinition', name: 'PHASE', defaultValue: "BUILD"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'TARGET_ENV', defaultValue: "DEV"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'ENV_DISPLAY', defaultValue: "envname_here"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'SKIP_QGS', defaultValue: "n"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'PROD_TRACK', defaultValue: "false"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'ECO_PIPELINE_ID', defaultValue: "manual"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'K8S_CLUSTER_URL', defaultValue: ""],
    [$class: 'hudson.model.StringParameterDefinition', name: 'K8S_USERNAME', defaultValue: ""],
    [$class: 'hudson.model.PasswordParameterDefinition', name: 'K8S_PASSWORD', defaultValue: ""],
    [$class: 'hudson.model.PasswordParameterDefinition', name: 'K8S_TOKEN', defaultValue: ""],
    [$class: 'hudson.model.StringParameterDefinition', name: 'K8S_CONTEXT', defaultValue: "default"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'K8S_PODS_REPLICAS', defaultValue: "2"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'K8S_SERVICE_ACCOUNT', defaultValue: "default"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'K8S_NAME', defaultValue: "DEV"],
    [$class: 'hudson.model.BooleanParameterDefinition', name: 'USE_ROOT_NS', defaultValue: false],
    [$class: 'hudson.model.StringParameterDefinition', name: 'MECHID', defaultValue: ""],
    [$class: 'hudson.model.PasswordParameterDefinition', name: 'MECHID_PASSWORD', defaultValue: ""],
    [$class: 'hudson.model.StringParameterDefinition', name: 'CHANGELOG_PREVIOUS_RELEASE', defaultValue: "master"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'CHANGELOG_CURRENT_RELEASE', defaultValue: "release/1.0.0"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'APP_SHELL_URL', defaultValue: "https://idse3.dev.att.com:10081/mktg/v1/"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'DT_URL', defaultValue: "https://zlp11930.vci.att.com/e/c284519d-a458-42c2-b92f-eb428758d293"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'DT_TOKEN', defaultValue: "6qshBXHkTFiIE4XvjcnBh"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'JENKINS_DYNATRACE_EXECUTION', defaultValue: "false"],
    // Soasta Config
    [$class: 'hudson.model.StringParameterDefinition', name: 'SOASTA_URL',defaultValue: "http://zlp25969.vci.att.com:8080/concerto/"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'SOASTA_SCOMMAND',defaultValue: "/opt/app/scommand/bin/scommand"],
    [$class: 'hudson.model.StringParameterDefinition', name: 'SOASTA_COMP_NAME',defaultValue: ""],
    [$class: 'hudson.model.StringParameterDefinition', name: 'SOASTA_CLIP_NAME',defaultValue: ""],
    [$class: 'hudson.model.StringParameterDefinition', name: 'SOASTA_TARGET_NAME',defaultValue: ""],
    [$class: 'hudson.model.StringParameterDefinition', name: 'SOASTA_PERF_TARGET_URL',defaultValue: ""]
]]])

echo "Build branch: ${env.BRANCH_NAME}"

def branchName
def buildImageName

node("docker"){
    withEnv([
        "PROJECT_NAME=UF-App-Shell",
        "PROJECT_PLATFORM=Linux",
        "K8S_EXT_ES_HOST=zlp26061.vci.att.com",
        "K8S_EXT_MS_HOST=zlp26061.vci.att.com",
        "PROJECT_MAJOR_VERSION=1.0.0",
        "NO_PROXY=zlp26061.vci.att.com"
    ]){
        try {
            stage('Checkout') {
                deleteDir()
                sleep 3
                checkout scm
                echo "Cleaning up the build directory" 
                sh "git reset --hard" 
                sh "git clean -fdx -f"
            }

            echo "after Checkout"
            // Setting env variable for pact START
            env.PACT="yes"

            // Setting env variable for pact END
            env.builduser=readFile './builduser.txt'
            env.BUILDNUMBER="${BUILD_NUMBER}"

            yorc = readJSON file: '.yo-rc.json'
            echo "yorc:" + yorc

            PROJECT_NAME = yorc["@com.att.ajsc/generator-ansc"].servicenamespace + ":" + yorc["@com.att.ajsc/generator-ansc"].servicename;
            SERVICE_NAME = yorc["@com.att.ajsc/generator-ansc"].servicename;
            NAMESPACE = yorc["@com.att.ajsc/generator-ansc"].servicenamespace;
            VERSION = yorc["@com.att.ajsc/generator-ansc"].serviceversion;
            
            packagejson = readJSON file: 'package.json'
            PACKAGE_VERSION = packagejson.version;
            echo "PACKAGE_VERSION = ${PACKAGE_VERSION}"

            if ("${PHASE}" == "PUSH_REQUEST") {
                stage(" push to repo") {
                    node("zlt23447.vci.att.com"){
                        sh '''
                            cd /opt/app/workload/enabler/jenkins_slave
                            ./script.sh
                        '''
                    }
                }
            }

            try {
                TARGET_ENV = TARGET_ENV.toLowerCase()
            } catch (groovy.lang.MissingPropertyException e) {
                TARGET_ENV = "dev"
            }

            if (ENV_DISPLAY == "envname_here") {
                ENV_DISPLAY = TARGET_ENV
            }

            if (params.USE_ROOT_NS) {
                KUBE_NAMESPACE = NAMESPACE.replaceAll(/\./, "-")
            } else {
                KUBE_NAMESPACE = NAMESPACE.replaceAll(/\./, "-")
            }

            if (env.PHASE == null) {
                env.PHASE="BUILD"
            }
            
            echo "Kube NameSpace: " + KUBE_NAMESPACE
            echo "Artifact: " + PROJECT_NAME

            branchName = (env.BRANCH_NAME ?: "master").replaceAll(/[^0-9a-zA-Z_]/, "-")

            if (params.PROD_TRACK == "true") {
                IMAGE_TAG = "${params.ECO_PIPELINE_ID}"
            } else {
                IMAGE_TAG = "ssr-${branchName}.latest"
            }

            buildImageName = "${NAMESPACE}/${SERVICE_NAME}:" + IMAGE_TAG
            def dockerRegistry = "dockercentral.it.att.com:5100"
            IMAGE_NAME = "${dockerRegistry}/$buildImageName"
      		NGX_IMAGE_NAME = "${dockerRegistry}/com.att.idp/mktg-app-shell-nginx:${IMAGE_TAG}"
      		
            TESTS_REPORTS = "No tests executed"

            currentBuild.displayName = "${ECO_PIPELINE_ID}-${PHASE}-${ENV_DISPLAY}-${VERSION}"
            currentBuild.description = "${VERSION} ${ECO_PIPELINE_ID} ${PHASE}"

            if ("${PHASE}" == "CHANGELOG") {
                stage('changelog') {
                    echo "WORKSPACE ${WORKSPACE}"
                    sshagent(['kc165s']) {
                        gitRepoUrl = sh(returnStdout: true, script: 'git config remote.origin.url').trim().tokenize('/')
                        projRepoURI = "${gitRepoUrl[gitRepoUrl.size()-2]}/${gitRepoUrl[gitRepoUrl.size()-1]}"
                        echo "REPO URI : ${projRepoURI}"
                        echo "Setting origin to: ssh://git@codecloud.web.att.com:7999/${projRepoURI}"
                        sh "git remote set-url origin ssh://git@codecloud.web.att.com:7999/${projRepoURI}"
                        sh 'printf "Current Version: ${CHANGELOG_CURRENT_RELEASE}\nFeatures and Improvements:\n" > CHANGELOG.md'
                        sh 'git log --pretty=format:"%Creset %s" --abbrev-commit --no-merges remotes/origin/${CHANGELOG_PREVIOUS_RELEASE}..remotes/origin/${CHANGELOG_CURRENT_RELEASE} > temp.txt'
                        sh 'sed -i "s/^..../ /g" temp.txt'
                        sh 'cat temp.txt >> CHANGELOG.md'
                        echo "DISPLAYING CHANGELOG.md in folder"
                        sh 'cat CHANGELOG.md'
                        sh 'git add CHANGELOG.md'
                        sh 'git commit -a -m "[kc-0000] Commiting the generated changelog to source"'
                        sh "git push --set-upstream origin ${CHANGELOG_CURRENT_RELEASE}"
                        sh 'git reset'
                    }
                }
            }

            if ("${PHASE}" == "BUILD" || "${PHASE}" == "BUILD_DEPLOY") {
                wrap(
                    [$class: 'ConfigFileBuildWrapper',
                        managedFiles: [
                            [fileId: 'sonar.properties', variable: 'SONAR_PROPERTIES']
                        ]
                    ]) {

                    withCredentials([usernamePassword(credentialsId: env.builduser, passwordVariable: 'password', usernameVariable: 'username')]) {
                        sh "docker login -u ${username} -p '${password}' ${dockerRegistry}"
                    }

                    docker.image("dockercentral.it.att.com:5100/com.att.idp/node-gulp-yarn:12.13.0").inside {
                        withEnv([
                            'TARGET_ENV=${TARGET_ENV}',
                            'npm_config_cache=npm-cache',
                            'HOME=.',
                        ]){
                            sh "npm config set proxy http://sub.proxy.att.com:8080/"
					        sh "npm config set https-proxy http://sub.proxy.att.com:8080/"
                            //sh "npm config set registry http://mavencentral.it.att.com:8084/nexus/content/groups/npm-all/"

  		
                            stage("NPM install") {
                                sh "node -v"
                                sh "rm -rf node_modules"
                                withCredentials([usernamePassword(credentialsId: 'm10578_npm_publish', passwordVariable: 'password', usernameVariable: 'username')]) {
                                sh "npm config set registry http://mavencentral.it.att.com:8081/nexus/repository/npm-all/"
                                sh "npm set email ${username}"
                                sh "npm set _auth ${password}"
                                sh "npm set always-auth=true"
      }
                                sh "rm yarn.lock"
					            sh "yarn && yarn upgrade --scope @uf"
                                echo "Debug, looking for version of idp-core-upperfunnel"
                                sh "grep -A 2 idp-core-upperfunnel yarn.lock"
                            }

                            // stage("Unit Test") {
                            //     try {
                            //         sh "yarn test:coverage -u"
                            //     }
                            //     catch (Exception ex) {
                            //         println "Unit Test cases are failing...Continuing the build"
                            //     }
                            // }

                            // stage("Sonar") {
                            //     withSonarQubeEnv('SonarQube') {
                            //         def props = readProperties file: "${env.SONAR_PROPERTIES}"
                            //         sh "yarn add gulp-load-plugins gulp-nodemon gulp-shell gulp-sonar"
                            //         sh "gulp sonarscan --motsid=${props["sonar.att.motsid"]} --url=${props["sonar.host.url"]} --login=${props["sonar.login"]} --password=${props["sonar.password"]} --sonar.ts.coverage.lcovReportPath=${props["sonar.ts.coverage.lcovReportPath"]} --viewtype=${props["sonar.att.view.type"]}"
                            //     }
                            //     // Just in case something goes wrong, pipeline will be killed after a timeout
                            //     timeout(time: 7, unit: 'MINUTES') {
                            //         // Reuse taskId previously collected by withSonarQubeEnv
                            //         def qg = waitForQualityGate()
                            //         if (qg.status != 'OK') {
                            //             error "Pipeline aborted due to quality gate failure: ${qg.status}"
                            //         }
                            //     }
                            // }

                            stage("Build Webapp") {
                                    sh '''
                                        echo "versions = `yarn list --depth=0 --json --pattern '@uf|@idp|next'`;" >> server/server.ts
                                    '''
                                    sh "yarn build"
                                    sh "yarn version --new-version patch --no-git-tag-version"
                                    echo "Debug, looking for latest version of idp-core-upperfunnel"
                                    sh "yarn upgrade --scope @uf/idp-core-upperfunnel"                                    
                                    echo "Generate pre-compressed .gz and .br files for dist/static files"
                                    sh "yarn compress"
                                }

                            // stage("Contract Testing") {
                            //   sh "cd src/server/test/ContractTest/pact-consumer; rm -rf node_modules; rm -rf logs; rm -rf pacts; rm -rf yarn.lock; yarn ; npm config delete http-proxy; npm config rm proxy; unset HTTP_PROXY; unset http_proxy; yarn pact:generate; yarn pact:publish"
                            //   sh "npm config set proxy http://sub.proxy.att.com:8080/"
                            //   sh "npm config set https-proxy http://sub.proxy.att.com:8080/"
                            //   sh "npm config set registry http://mavencentral.it.att.com:8084/nexus/content/groups/npm-all/"
                            // }
                        }
                    }

                    def hostname = "tcp://" + env.NODE_NAME + ":4243"
                    print hostname
                    env.DOCKER_HOST=hostname
                    env.DOCKER_TLS_VERIFY=1

					stage('Package NodeJS') {
                        sh "tar czf ./docker/idpnode.tar.gz package.json next.config.js dist node_modules config"
                        dir('docker') {
                            sh "docker build -f Dockerfile -t ${IMAGE_NAME} ."
                        }
                    }
                    
                    stage('Package Nginx') {
                        dir('docker') {
                            sh "docker build -f Dockerfile-nginx -t ${NGX_IMAGE_NAME} ."
                            sh "docker push ${NGX_IMAGE_NAME}"
                            
                            NGX_IMAGE_HASH = sh(returnStdout: true, script: "docker inspect --format='{{index .RepoDigests 0}}' ${NGX_IMAGE_NAME}").trim()
                            echo "Pushed docker image is ${NGX_IMAGE_HASH}."
                            if (params.PROD_TRACK!="true") {
                                // For the push later, we need to use the Image Hash intead of the Image name.
                                // at the time of this writing, IMAGE_NAME is only used after this point during deployment.
                                // If this changes later, then this logic may need to be changed.
                                // Not needed for prod-track builds, as these builds are already uniquely tagged.
                                NGX_IMAGE_NAME = NGX_IMAGE_HASH
                            }
                        }
                    }

                    // stage ('Docker Build') {
                    //     sh "docker build -f Dockerfile -t ${IMAGE_NAME} ."
                    // }



                    stage('Smoke Test') {
                        echo 'Stop and remove the existing container (If any exists)'
                        try {
                            def docker_stop = 'docker stop ' + SERVICE_NAME
                            def docker_remove = 'docker rm ' + SERVICE_NAME
                            sh docker_stop
                            sh docker_remove
                        } catch (Exception ex) {
                            println("Unable to stop and/or remove the docker container - " + SERVICE_NAME);
                            println(ex.getStackTrace());
                        }

                        echo 'Run the Docker Image'
                        def docker_run = 'docker run -P' + ' --name=' + SERVICE_NAME + ' -d -t ' + IMAGE_NAME
                        sh docker_run
                        sh "docker ps | grep ${SERVICE_NAME} "

                        echo 'Check the status of the Docker Container. If the status is not running, sleep for a defined interval of 1 sec and check again until 1 min timeout'
                        timeout(time: 1, unit: 'MINUTES') {
                            def wait_for_docker = 'until [ "`docker inspect -f {{.State.Running}} ' + SERVICE_NAME + '`"=="true" ]; do sleep 1; done;'
                            println("Sleeping for 1 sec and wait for the Docker Container - " + SERVICE_NAME + " to start");
                            sh wait_for_docker
                        }

                        echo 'Identify the Port and the Url of the docker container'
                        def inspectCmd = 'docker inspect --format=' + '\'' + '{{(index (index .NetworkSettings.Ports "3000/tcp") 0).HostPort}}' + '\' ' + SERVICE_NAME
                        APP_PORT = sh(script: inspectCmd, returnStdout: true).trim()
                        println("Docker Container - " + SERVICE_NAME + " is running on Port: " + APP_PORT);
                        APP_URL = "http:" + DOCKER_HOST.split(/:/)[1] + ":" + APP_PORT
                        println("Docker Container - " + SERVICE_NAME + " - Application Url: " + APP_URL);

                        try {
                            echo 'Check if the Spring Boot container has started. If it is not up, sleep for a defined interval of 5 sec and check again until 2 min timeout'
                            timeout(time: 4, unit: 'MINUTES') {
                                def url = APP_URL + "/mktg/v1/"
                                def wait_for_app = 'until $(curl --output /dev/null --silent --head --fail ' + url + '); do sleep 5; done;'
                                println("Sleeping for 5 sec and wait for the App to startup - " + url);
                                sh wait_for_app
                            }
                        } catch (Exception ex) {
                            def docker_logs = 'docker logs --tail 500 ' + SERVICE_NAME
                            println("Smoke Testing Failed - Docker Logs");
                            sh docker_logs
                            println("Exception while trying to spin up the Docker Container for Smoke Testing.  Exception - " + ex.getStackTrace());
                        }

                        def smoke_testing_script = "curl -s -o /dev/null -w '%{http_code}' --noproxy '*' --request GET --url " + APP_URL + "/mktg/v1/"
                        def HTTP_STATUS = sh(script: smoke_testing_script, returnStdout: true).trim()
                        println("Http status code returned from the Health Check Url - " + HTTP_STATUS);

                        try {
                            if (HTTP_STATUS.trim().equals("200")) {
                                println("Smoke Testing completed successfully. Health Check Http Status Code - " + HTTP_STATUS);
                            } else {
                                println("Smoke Testing failed. Health Check Http Status Code - " + HTTP_STATUS);
                                error("Aborting the build since the Smoke Testing failed.")
                            }
                        } finally {
                            try {
                                echo 'Stop and remove the docker container'
                                def docker_stop = 'docker stop ' + SERVICE_NAME
                                def docker_remove = 'docker rm ' + SERVICE_NAME
                                sh docker_stop
                                sh docker_remove
                            } catch (Exception ex) {
                                println("Unable to stop and/or remove the docker container - " + SERVICE_NAME);
                                println(ex.getStackTrace());
                            }
                        }
                        env.DOCKER_HOST=""
                        env.DOCKER_TLS_VERIFY=""
                    }

                    stage('Docker Push') {
                        sh "docker push ${IMAGE_NAME}"
                        // IMAGE_NAME hashing per: https://wiki.web.att.com/display/SSI/DockerCentral+Stale+Images+Fix#DockerCentralStaleImagesFix-ForNginx/NodeJSApps
                        IMAGE_HASH = sh(returnStdout: true, script: "docker inspect --format='{{index .RepoDigests 0}}' ${IMAGE_NAME}").trim()
                        echo "Pushed docker image is ${IMAGE_HASH}."
                        if (params.PROD_TRACK != "true") {
                            // For the push later, we need to use the Image Hash intead of the Image name.
                            // at the time of this writing, IMAGE_NAME is only used after this point during deployment.
                            // If this changes later, then this logic may need to be changed.
                            // Not needed for prod-track builds, as these builds are already uniquely tagged.
                            IMAGE_NAME = IMAGE_HASH
                        }
                    }

                    stage("Update GIT") {
                        withCredentials([usernamePassword(credentialsId: 'git_m10578', passwordVariable: 'password', usernameVariable: 'username')]) {
                            sh """
                                git remote set-url origin https://${username}:${password}@codecloud.web.att.com/scm/st_idse/idp-ssr-shell.git
                                #echo "Increment package.json version"
                                #yarn version --new-version patch --no-git-tag-version
                                git config --global user.email "${username}@att.com"
                                git config --global user.name "${username}"
                                git add package.json
                                git add yarn.lock
                                git commit -m "[12345] Incremented version in package.json"
                                git push origin HEAD:${env.BRANCH_NAME}
                                git reset --hard
                            """
                        }
                    }

                    // stage ('Troubleshoot Cleanup') {
                    //     sh "git clean -fd"
                    //     sh "ls -lsh"
                    // }
                }
            }
            
            stage('Capture Static Files for Netstorage') {
	            if ("${PHASE}" == "BUILD_DEPLOY" || "${PHASE}" == "BUILD" || "${PHASE}" == "NETSTORAGE" ) {
                       //PACKAGE_VERSION="3.0.424"
	            
	               echo "PACKAGE_VERSION = ${PACKAGE_VERSION}"

                   withCredentials([usernamePassword(credentialsId: 'git_m10578', passwordVariable: 'password', usernameVariable: 'username')]) {
           			 
	                    sh """
                            ## zip -rp ssr-shell-static-files-${PACKAGE_VERSION}.zip ./dist/static/*
                            rm -rf akamai_netstorage
	                        mkdir akamai_netstorage
                            cd akamai_netstorage
                            git clone https://${username}:${password}@codecloud.web.att.com/scm/st_idse/idp-ssr-shell-netstorage.git
                            echo Show package version ${PACKAGE_VERSION}
                            
                            mkdir -p ./idp-ssr-shell-netstorage/idp-ssr-shell-static-files/static_${PACKAGE_VERSION}
                            cp -rp ../dist/static/* ./idp-ssr-shell-netstorage/idp-ssr-shell-static-files/static_${PACKAGE_VERSION}/

							              cd idp-ssr-shell-netstorage
                            git config --global user.email "${username}@att.com"
                            git config --global user.name "${username}"
                            git remote set-url origin https://${username}:${password}@codecloud.web.att.com/scm/st_idse/idp-ssr-shell-netstorage.git 
                            git add -A idp-ssr-shell-static-files/static_${PACKAGE_VERSION}
                            git commit -m "[netstorage] Adding files for release version ${PACKAGE_VERSION}"
                            git push origin HEAD:master --force
                            git status

                            ./scripts/push-to-netstorage.sh
		            """
	               }
	            }
            }
            
            
            //stage('Send Static Files to Netstorage') {
	            // if ("${PHASE}" == "BUILD_DEPLOY" || "${PHASE}" == "DEPLOY" || "${PHASE}" == "NETSTORAGE" ) {
                //     sh """ 
                //     #git remote set-url origin https://${username}:${password}@codecloud.web.att.com/scm/st_idse/idp-ssr-shell-netstorage.git 
                //     #./scripts/push-to-netstorage.sh" 
                //     """
	            
	            // }
            //}
            

            if ("${PHASE}" == "BUILD_DEPLOY" || "${PHASE}" == "DEPLOY" || "${PHASE}" == "DEPLOY_TEST" || "${PHASE}" == "DEPLOY_monitorStage_FF" || "${PHASE}" == "DEPLOY_PERF" || "${PHASE}" == "DEPLOY_PROD_FF") {
                //deploy to k8s
                //if (branchName == 'master') {
                stage('Deploy to Kubernetes') {
                    if ("${K8S_TOKEN}" != "") {
                        KUBECTL_OPTS = "--server=${K8S_CLUSTER_URL} --insecure-skip-tls-verify=true --token=${K8S_TOKEN}"
                    } else {
                        KUBECTL_OPTS = "--server=${K8S_CLUSTER_URL} --insecure-skip-tls-verify=true --password=${K8S_PASSWORD} --username=${K8S_USERNAME}"
                    }

                    withEnv([
                        "APP_NAME=${SERVICE_NAME}",
                        "K8S_CTX=${K8S_CONTEXT}",
                        "APP_NS=${KUBE_NAMESPACE}",
                        "ECO_PIPELINE_ID=${ECO_PIPELINE_ID}",
                        "BUILD_NUMBER=${BUILD_NUMBER}",
                        "TARGET_ENV=${TARGET_ENV}",
                        "IMAGE_NAME=${IMAGE_NAME}",
                        "NGX_IMAGE_NAME=${NGX_IMAGE_NAME}",
                        "VERSION=${VERSION}",
                        "REPLICA_COUNT=${params.K8S_PODS_REPLICAS}",
                        "SERVICE_ACCOUNT=${K8S_SERVICE_ACCOUNT}",
                        "MECHID=${MECHID}",
                        "MECHID_PASSWORD=${MECHID_PASSWORD}",
                        "KUBECTL=/opt/app/kubernetes/v1.9.3/bin/kubectl --kubeconfig=admin.conf",
                        "KUBECTL_OPTS=${KUBECTL_OPTS}"
                    ]) {
                        // createDynatraceDeploymentEvent(
                        //     envId: 'Dynatrace Demo Environment',
                        //     tagMatchRules: [
                        //         [
                        //             meTypes: [
                        //                 [meType: 'PROCESS_GROUP']
                        //             ],
                        //             tags: [
                        //                 [context: 'CONTEXTLESS', key: '', value: 'frontend']
                        //             ]
                        //         ]
                        //     ]) {
                            // some block
                            sh "chmod 755 k8s/deploy.sh"
                            sh "dos2unix ./k8s/deploy.sh"
                            sh "bash -x ./k8s/deploy.sh"
                        // }
                    }
                }
            }

            if ("${PHASE}" == "BUILD_DEPLOY" || "${PHASE}" == "DEPLOY" || "${PHASE}" == "HEALTH_CHECK") {
                stage('K8 Health Check') {
                    withEnv([
                        "APP_NAME=${SERVICE_NAME}",
                        "APP_NS=${KUBE_NAMESPACE}",
                        "KUBECTL=/opt/app/kubernetes/v1.9.3/bin/kubectl --kubeconfig=admin.conf",
                        "KUBECTL_OPTS=${KUBECTL_OPTS}"
                    ]) {

                        def CLUSTER_URL = K8S_CLUSTER_URL[8..- 6]
                        NODE_PORT = sh(script: '${KUBECTL} get service ${APP_NAME} --namespace ${APP_NS} ${KUBECTL_OPTS} --output jsonpath={.spec.ports[0].nodePort}', returnStdout: true).trim()
                        def API_ENDPOINT = "https://${CLUSTER_URL}:${NODE_PORT}" + "/mktg/v1/"
                        echo "Cluster URL with Port - ${API_ENDPOINT}"
                        timeout(time: 7, unit: 'MINUTES') {
                            waitUntil {
                                try {
                                    sh "curl -ks --head  --request GET ${API_ENDPOINT} | grep '200'"
                                    return true
                                } catch (Exception e) {
                                    return false
                                }
                            }
                        }
                    }
                }
            }

            // if ("${PHASE}" == "BUILD_DEPLOY" || "${PHASE}" == "PERFORMANCE_TEST") {
            //     env.DOCKER_HOST=""
            //     env.DOCKER_TLS_VERIFY=""
            //     stage('Performance Test 1') {
            //         if (!SKIP_QGS.contains("PT")) {
            //             docker.image("dockercentral.it.att.com:5100/com.att.idp/node-wpt:1.0").inside {
            //                 withEnv([
            //                     "buildNo=${BUILD_NUMBER}",
            //                     'npm_config_cache=npm-cache',
            //                     'HOME=.',
            //                 ]){
            //                     echo "TEST1"
            //                     sh "npm config set proxy http://sub.proxy.att.com:8080/"
            //                     sh "npm config set https-proxy http://sub.proxy.att.com:8080/"
            //                     echo "TEST2"
            //                     def OUTPUT = sh(script: "wpt-reporter --webPageTestKey --lighthouse --reporter csv --file WPT_Results_Build_'$buildNo'.csv --runs 1 --webPageTestHost http://zlt19578.vci.att.com:7000/ --location Test:Chrome https://idse3.dev.att.com:10081/mktg/v1/", returnStdout: true).trim()
            //                     println("WPT Results - " + OUTPUT);
            //                     sh "sendemail -f DL-IDPENVMGMT@att.com -t IDSE-UIFramework@list.att.com -cc DL-IDPENVMGMT@att.com,sg060k@att.com, -u WPT Test Result Report Build No: '$buildNo'  -m 'WPT Performance Report  URL for Upperfunnel given below: \n $OUTPUT' -a WPT_Results_Build_'$buildNo'.csv -s smtp.it.att.com:25"
            //                 }
            //             }
            //         }
            //     }
            // }

			 // Perf testing using SOASTA 
            if ("${PHASE}" == "BUILD_DEPLOY" || "${PHASE}" == "DEPLOY" || "${PHASE}" == "PERF_TEST" || "${PHASE}" == "PERF_LOAD_TEST") {
                    // Execute the Load Test
                    stage ('SOASTA Performance Test') {
                    // try {
                    //             //SOASTA_COMP_NAME 		= (SOASTA_COMP_NAME == "" ? "/IDP/COMP/${SERVICE_NAME}/${VERSION_NO}/IDP_${SERVICE_NAME}_COMP" : "${SOASTA_COMP_NAME}")
                    //             SOASTA_COMP_NAME 		= (SOASTA_COMP_NAME == "" ? "/UpperFunnel/Version1/IDP_UpperFunnel_COMP_VERSION1" : "${SOASTA_COMP_NAME}")
                    //             SOASTA_CLIP_NAME 		= (SOASTA_CLIP_NAME == "" ? "UpperFunnel_DealsPage 1" : "${SOASTA_CLIP_NAME}")
                    //             SOASTA_TARGET_NAME 		= (SOASTA_TARGET_NAME == "" ? "IDP_${SERVICE_NAME}_TARGET" : "${SOASTA_TARGET_NAME}")
                    //             //SOASTA_PERF_TARGET_URL	= (SOASTA_PERF_TARGET_URL == "" ? "${K8_APP_URL}" : "${SOASTA_PERF_TARGET_URL}")
                    //             SOASTA_PERF_TARGET_URL	= (SOASTA_PERF_TARGET_URL == "" ? "https://origin-idse-perf-ffdc.test.att.com:8443" : "${SOASTA_PERF_TARGET_URL}")

                    //             withCredentials([usernamePassword(credentialsId: 'SoastaCred', usernameVariable: 'SOASTA_USERNAME', passwordVariable: 'SOASTA_PASSWORD')]) {
                    //                 def exec = '${SOASTA_SCOMMAND} ' + 
                    //                 'url=${SOASTA_URL} ' + 
                    //                 'username=${SOASTA_USERNAME} ' + 
                    //                 'password=${SOASTA_PASSWORD} ' + 
                    //                 'cmd=play wait format=junitxml failonerror=no ' + 
                    //                 // 'customproperty=/vUsers=' + vUsers + ' ' + 
                    //                 // 'customproperty=/maxDuration=' + vMaxDuration + ' ' + 
                    //                 //'customproperty=/rampUpInterval=' + vRampUpInterval + ' ' + 
                    //                 //'customproperty=/rampDownInterval=' + vRampDownInterval + ' ' + 
                    //                 "name=${SOASTA_COMP_NAME} " +
                    //                 "'systemproperty=Band 1/Track 2/${SOASTA_CLIP_NAME}/${SOASTA_TARGET_NAME} (${SOASTA_TARGET_NAME})/URL=${SOASTA_PERF_TARGET_URL}'"
                    //                 result = sh(script: exec, returnStdout: true).trim()
                    //                 println("Performance Test Result - " + result);
                    //                 def tagName = "message"
                    //                     if (result.contains("<failure")) {
                    //                         int tagOpenIndex = result.indexOf("<" + tagName )
                    //                         int tagCloseIndex   = result.indexOf("</"+ tagName +">")        
                    //                                 if (tagOpenIndex != -1 && tagCloseIndex != -1) {
                    //                                     // Be sure the opening and closing tags were both found in the String
                    //                                     // The length of the opening tag = the length of the tag itself + 1 (the closing delimiter ">")
                    //                                         int lenOpenTag =  tagName.length() + 3;
                    //                                     // the start index of the value enclosed in the tags is the start index of the opening tag + the length of the opening tag 
                    //                                         int valueStartIndex = tagOpenIndex + lenOpenTag; 
                    //                                     // Getting the substring between the valueStartIndex and the start index of the closing tag
                    //                                         res = result.substring(valueStartIndex, tagCloseIndex);
                    //                                         res = res.split('>')[1]
                    //                                         error(res)
                    //                                 }
                    //                         }
                    //                 echo " SOASTA Performance Test - Executed Successfully"
                    //             }
                    //     } catch (Exception ex) {
                    //         echo "Performance Test - Execution Failed"
                    //         println("Exception while invoking the Performance Test with Exception - " + ex)
                    //         throw ex
                    //     }
                }
            }
            
            if ("${PHASE}" == "BUILD_DEPLOY" || "${PHASE}" == "INTEGRATION_TEST") {
                // docker.image("dockercentral.it.att.com:5100/com.att.idp/node-gulp-yarn:10.15.3").inside {
                // 	withEnv([
                // 	  'npm_config_cache=npm-cache',
                // 	  'HOME=.'
                // 	]){
                // 		stage ('Automation-Tests') {
                // 			try {
                // 				sh "yarn -v"
                // 				sh "yarn test-e2e"

                //         // E2e Analytics test
                //         // sh "yarn test-e2e-analytics"
                // 			}
                // 			catch(Exception ex) {
                // 				println(ex.getStackTrace());
                // 				//   throw ex;
                // 			} finally {
                // 				//junit 'e2e/reports/*.xml'
                // 				//TESTS_REPORTS="${env.BUILD_URL}/testReport/"
                // 				//sh "./sum_junit_tests.sh e2e/reports/"
                // 				currentBuild.result='SUCCESS'
                // 			}
                // 		}
                // 	}
                // }
            }

            if ("${PHASE}" == "DEPLOY" || "${PHASE}" == "INTEGRATION_TEST_QA") {
                // stage ('Integration Test on QA') {
                // 			try {
                // 				build '../com.att.idp/Automatics/IDSE'
                // 			}
                // 			catch(Exception ex) {
                // 			  println(ex.getStackTrace());
                // 			}
                // }
            }

            if ("${PHASE}" == "BUILD_DEPLOY" || "${PHASE}" == "DEPLOY" || "${PHASE}" == "PERFORMANCE_TEST") {
                docker.image("dockercentral.it.att.com:5100/com.att.idp/lighthouse:5.6.0").inside {
                	withEnv([
                    "HTTP_PROXY=http://sub.proxy.att.com:8080", 
                    "HTTPS_PROXY=http://sub.proxy.att.com:8080",
                		"APP_SHELL_URL=${APP_SHELL_URL}",
                		"buildNo=${BUILD_NUMBER}"
                	]) {
                			stage ('Performance Test 2') {
                				try {
                					 sh "mkdir -p reports"
                            sh "cp budget.json ./reports/"
                					 sh "lighthouse --port=9222 --budget-path=./reports/budget.json  --output json --output html --output-path reports/Report_'${BUILD_NUMBER}'_Build.json  --chrome-flags='--headless --proxy-server=http://sub.proxy.att.com:8080 --no-sandbox -disable-gpu --ignore-certificate-errors' --emulated-form-factor=mobile --only-categories=performance,accessibility,seo,best-practices ${APP_SHELL_URL} --view"
                					 // sh "sendemail -f DL-IDPENVMGMT@att.com -cc DL-WB_Enablers@list.att.com -u Lighthouse Performance Report Build No: '$buildNo'  -m 'Lighthouse Performance Report for IDP SSR Shell' -a reports/Report_'$buildNo'_Build.report.html -s smtp.it.att.com:25"
                				}
                				catch(Exception ex) {
                					println(ex.getStackTrace());
                					throw ex;
                				}
                			}
                		}
                	stage ('publishHTML') {
                    publishHTML (target: [
                    allowMissing: false,
                    alwaysLinkToLastBuild: false,
                    keepAll: true,
                    reportDir: 'reports',
                    reportFiles: "Report_${BUILD_NUMBER}_Build.report.html",
                    reportName: "Lighthouse Report"
                    ])
                }
              }
            }

            // if ("${PHASE}" == "BUILD_DEPLOY" || "${PHASE}" == "DEPLOY") {
                echo "Checking JENKINS_DYNATRACE_EXECUTION ::: "
                // echo "without params ::: " JENKINS_DYNATRACE_EXECUTION
                // echo "with dollar and params ::: ${params.JENKINS_DYNATRACE_EXECUTION}" 
                // echo "with env params ::: " env.JENKINS_DYNATRACE_EXECUTION
                // echo "with dollar params ::: ${JENKINS_DYNATRACE_EXECUTION} "
                if ("${JENKINS_DYNATRACE_EXECUTION}" == "true") {
                    try {
                        stage("Jenkins DynaTrace") {
                            echo "Coming in JenDyn Phase"
                            echo "ENV_DISPLAY Details :: ${ENV_DISPLAY}"
                            echo "BUILD_TAG Details :: ${BUILD_TAG}"
                            echo "BUILD_NUMBER Details :: ${BUILD_NUMBER}"
                            echo "JOB_NAME Details :: ${JOB_NAME}"
                            echo "JENKINS_URL Details :: ${JENKINS_URL}"
                            echo "JOB_URL Details :: ${JOB_URL}"
                            echo "BUILD_URL Details :: ${BUILD_URL}"
                            echo "APP_NS/KUBE_NAMESPACE Details :: ${KUBE_NAMESPACE}"
                    //         // Define an app instance and prepare metadata for Dynatrace
                    //         // def app = docker.image("sample-nodejs-service:${BUILD_NUMBER}")
                            // def app = docker.image("${IMAGE_NAME}")
                            // app.run("--name SampleJenkinsDynaTraceStaging -p 80:80 " +
                            //         "-e 'DT_CLUSTER_ID=SampleJenkinsDynaTraceStaging' " + 
                            //         "-e 'DT_TAGS=Environment=Staging Service=${SERVICE_NAME}' " +
                            //         "-e 'DT_CUSTOM_PROP=ENVIRONMENT=Staging JOB_NAME=${JOB_NAME} " + 
                            //             "BUILD_TAG=${BUILD_TAG} BUILD_NUMBER=${BUILD_NUMBER}'")

                    //         // push a deployment event on the host with the tag [CONTEXTLESS]Environment:JenkinsDynaTraceInteg
                    sh 'chmod 777 ./pushdeployment.sh'
                            sh './pushdeployment.sh HOST CONTEXTLESS ${ENV_DISPLAY} JenkinsDynaTraceInteg ' +
                            '${BUILD_TAG} ${BUILD_NUMBER} ${JOB_NAME} ' + 
                            'Jenkins ${JENKINS_URL} ${JOB_URL} ${BUILD_URL} ${GIT_COMMIT} ${DT_URL} ${DT_TOKEN}'

                    //         // run off with actual deployment steps - once metadata is sent to DynaTrace
                        }

                        def rootDir = pwd();
                        def externalFileCall = load "${rootDir}/pushDynatraceDeploymentEvent.groovy";

                        // Kept separate so that we can separately manage the entities
                        def entityRules = [
                            'SERVICE','CUSTOM_SERVICE'
                        ]

                        def tagMatchRules = [
                        [
                            meTypes: [
                                [meType: 'SERVICE']
                            ],
                            tags : [
                                // [context: 'CONTEXTLESS', key: 'app', value: 'IDSE_UI'],
                                // [context: 'CONTEXTLESS', key: 'appname', value: "${SERVICE_NAME}"],
                                // [context: 'CONTEXTLESS', key: 'environment', value: 'DEV2']
                                [context: 'CONTEXTLESS', key: 'app-container-name', value: "mktg-app-shell"]
                            ]
                        ]
                        ]

                        def customPropertyValues = [
                                [key: 'Jenkins Build Number', value: "${BUILD_NUMBER}"],
                                [key: 'Jenkins Build Tag', value: "${BUILD_TAG}"],
                                [key: 'Jenkins Job', value: "${JOB_NAME}"]
                            ]

                        stage('Add Dynatrace Deployment Event') {

                            def valuesMap = [:]
                            valuesMap.put('dtApiToken', "${DT_TOKEN}")
                            valuesMap.put('dtTenantUrl', "${DT_URL}")
                            valuesMap.put('ciBackLink', "${JENKINS_URL}")
                            valuesMap.put('deploymentVersion', "${VERSION}")
                            valuesMap.put('entityIds', entityRules)
                            valuesMap.put('tagRule', tagMatchRules)
                            valuesMap.put('customProperties', customPropertyValues)

                            echo "valuesMap object ::: " + valuesMap

                            def eventPayLoad = '{'
                            eventPayLoad += '"eventType": "CUSTOM_DEPLOYMENT",'
                            eventPayLoad += '"timeoutMinutes": 0,'
                            eventPayLoad += '"attachRules": {'
                            eventPayLoad += '"tagRule": [{'
                            eventPayLoad += '"meTypes": ['
                            eventPayLoad += '"CUSTOM_SERVICE"'
                            eventPayLoad += '],'
                            eventPayLoad += '"tags": ['
                            // eventPayLoad += '		{"context": "CONTEXTLESS",'
                            // eventPayLoad += '"key": "app",'
                            // eventPayLoad += '"value": "IDSE_UI"'
                            // eventPayLoad += '},'
                            // eventPayLoad += '{'
                            // eventPayLoad += '"context": "CONTEXTLESS",'
                            // eventPayLoad += '"key": "appname",'
                            // eventPayLoad += '"value": "${SERVICE_NAME}"'
                            // eventPayLoad += '},'
                            eventPayLoad += '{'
                            eventPayLoad += '"context": "CONTEXTLESS",'
                            eventPayLoad += '"key": "app-container-name",'
                            eventPayLoad += '"value": "mktg-app-shell"'
                            eventPayLoad += '}'
                            // eventPayLoad += '{'
                            // eventPayLoad += '"context": "CONTEXTLESS",'
                            // eventPayLoad += '"key": "environment",'
                            // eventPayLoad += '"value": \''
                            // eventPayLoad += "${SERVICE_NAME}"
                            // eventPayLoad += '\'}'
                            eventPayLoad += ']'
                            eventPayLoad += '}]'
                            eventPayLoad += '},'
                            eventPayLoad += '"source": "Jenkins",'
                            eventPayLoad += '"annotationType": "Monitoring",'
                            eventPayLoad += '"annotationDescription": "Build Check",'
                            eventPayLoad += '"deploymentName": "ssr-shell-mktg-app-shell",'
                            eventPayLoad += '"deploymentVersion": "1.1",'
                            eventPayLoad += '"deploymentProject": "mktg-app-shell",'
                            eventPayLoad += '"remediationAction": "http://revertMe",'
                            eventPayLoad += '"ciBackLink": "http://sdt-idp-ui.vci.att.com:27531/jenkins/job/com.att.idp/job/idp-ssr-shell/job/master/",'
                            eventPayLoad += '"customProperties": [{'
                            eventPayLoad += '"key": "Jenkins Build Tag",'
                            eventPayLoad += '"value": "${BUILD_TAG}"'
                            eventPayLoad += '},'
                            eventPayLoad += '{'
                            eventPayLoad += '"key": "Jenkins Job",'
                            eventPayLoad += '"value": "${JOB_NAME}"'
                            eventPayLoad += '},'
                            eventPayLoad += '{'
                            eventPayLoad += '"key": "Jenkins Build Number",'
                            eventPayLoad += '"value": "${BUILD_NUMBER}"'
                            eventPayLoad += '}'
                            eventPayLoad += ']'
                            eventPayLoad += '}'
                            echo "---> " + eventPayLoad
                            def status = externalFileCall.call(valuesMap)
                        }

                    }
                    catch(Exception ex) {
                        println(ex.getStackTrace());
                        throw ex;
                    }
                }
            // }

            if ("${TARGET_ENV}" == "TEST") {
                sh "echo IDSE_TEST | ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -i akm_cache_mgmt.key.txt m10578@zlp11902.vci.att.com"
            }
            emailext to: 'IDSE-UIFramework@list.att.com,PLATFORMUI_PRO@list.att.com,dl0633@att.com,sk227h@att.com,vg628k@att.com,db5699@att.com,va030e@att.com,mn446p@att.com,ad5575@att.com,io3956@att.com,sp103r@att.com,ac2201@att.com,kd0470@att.com,IDSE-ScrumMaster@list.att.com;',
            recipientProviders: [[$class: 'DevelopersRecipientProvider'], [$class: 'DevelopersRecipientProvider']],
            subject: 'IDP Job - ' + env.JOB_NAME + ' - Build No: ' + env.BUILD_NUMBER + ' - Successful!',
            body: 'Job: ' + env.JOB_NAME + '\n' +
                'Build No: ' + env.BUILD_NUMBER + '\n' +
                'Phase: ' + "${PHASE}" + '\n' +
                'Status: ' + 'Finished Successfully' + '\n\n' +
                'Jenkins Job: ' + env.BUILD_URL + '\n' +
                'Changes: ' + env.BUILD_URL + 'changes' + '\n' +
                'Console Log: ' + env.BUILD_URL + 'consoleFull'

        } catch (err) {
            stage('Send mail') {
                emailext to: 'IDSE-UIFramework@list.att.com,PLATFORMUI_PRO@list.att.com,dl-IDSE_TLV_DaVinci@intl.att.com,dl-IDSETLVDonatelo@intl.att.com,be683v@att.com,dl0633@att.com,sk227h@att.com,vg628k@att.com,db5699@att.com,va030e@att.com,mn446p@att.com,ad5575@att.com,io3956@att.com,sp103r@att.com,ac2201@att.com,kd0470@att.com,IDSE-ScrumMaster@list.att.com;',
                recipientProviders: [[$class: 'CulpritsRecipientProvider'], [$class: 'DevelopersRecipientProvider'], [$class: 'FailingTestSuspectsRecipientProvider']],
                subject: 'IDP Job - ' + env.JOB_NAME + ' - Build No: ' + env.BUILD_NUMBER + ' - Failed!',
                body: 'Job : ' + env.JOB_NAME + '\n' +
                    'Build No: ' + env.BUILD_NUMBER + '\n' +
                    'Phase: ' + "${PHASE}" + '\n' +
                    'Status: ' + 'Failed' + '\n\n' +
                    'Jenkins Job: ' + env.BUILD_URL + '\n' +
                    'Changes: ' + env.BUILD_URL + 'changes' + '\n' +
                    'Console Log: ' + env.BUILD_URL + 'consoleFull' + '\n\n' +
                    'Please take the necessary action to fix the broken build as soon as possible.' + '\n' +
                    'If you need any help from the Systems Team, please reach out to mailto:DL-IDPENVMGMT@att.com for assistance.'
            }
            throw (err)
        }
    }
}
