const express = require('express');
const k8s = require('@kubernetes/client-node');
const app = express();
const port = process.env.PORT || 3000;
const path = require('path');

const PATH = path.resolve(process.env.HOME, 'k3s.yaml');
console.log(`Using kubeconfig at: ${PATH}`);

// Initialize Kubernetes client
const kc = new k8s.KubeConfig();
kc.loadFromFile(PATH);
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

// app.get('/pod-status', async(req,res) => {
//     try{
//         const namespace = req.query.namespace;
//         console.log("The querying namespace param: ", namespace);

//         const pods = await k8sApi.listNamespacedPod({namespace: `${namespace}`});
//         console.log(pods)

//         const podStatus = pods.items.map(pod => ({
//             name: pod.metadata.name,
//             status: pod.status.phase
//         }));
//         res.json(podStatus);   

//     } catch(err) {
//         console.error("Get this error: ",err)
//     }
// })



app.get('/pod-status', async(req,res) => {
    try {
        const namespace = req.query.namespace;
        const releaseName = req.query['release-name'];
        
        console.log(`Querying namespace: ${namespace}, release: ${releaseName}`);
        
        if (!namespace) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'Namespace is required'
            });
        }

        // Create the options object for the API call
        const options = { namespace: namespace };
        
        // Add labelSelector if release name is provided
        if (releaseName) {
            options.labelSelector = `app.kubernetes.io/instance=${releaseName}`;
        }
        
        // Get pods with the provided filters
        const pods = await k8sApi.listNamespacedPod(options);
        
        const podStatus = pods.items.map(pod => ({
            name: pod.metadata.name,
            status: pod.status.phase,
            ready: isPodReady(pod),
            createdAt: pod.metadata.creationTimestamp
        }));
        
        res.json({
            namespace,
            releaseName: releaseName || 'all',
            podsCount: podStatus.length,
            pods: podStatus
        });
        
    } catch(err) {
        console.error("Error:", err);
        res.status(500).json({
            error: 'Failed to fetch pods',
            message: err.message
        });
    }
});

// Helper function to check if a pod is ready
function isPodReady(pod) {
    if (pod.status.phase !== 'Running') return false;
    
    const containerStatuses = pod.status.containerStatuses || [];
    if (containerStatuses.length === 0) return false;
    
    return containerStatuses.every(container => container.ready);
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
})