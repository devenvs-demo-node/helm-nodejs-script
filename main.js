const express = require("express");
const k8s = require("@kubernetes/client-node");
const app = express();
const port = process.env.PORT || 3000;
const path = require("path");

const PATH = path.resolve(process.env.HOME, "k3s.yaml");
console.log(`Using kubeconfig at: ${PATH}`);

// Initialize Kubernetes client
const kc = new k8s.KubeConfig();
kc.loadFromFile(PATH);
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sApi2 = kc.makeApiClient(k8s.AppsV1Api);

app.get("/", (req, res) => {
  res.send(
    "Go to this path: ?namespace=<your-namespace-name>&release-name=<your-release-name>"
  );
});

app.get("/pod-status", async (req, res) => {
  try {
    const namespace = req.query.namespace;
    const releaseName = req.query["release-name"];

    if (!namespace) {
      return res.status(400).json({
        error: "Missing parameter",
        message: "Namespace is required",
      });
    }

    if (!releaseName) {
      return res.status(400).json({
        error: "Missing parameter",
        message: "Release name is required",
      });
    }

    // Create the options object for the API call
    const options = { namespace: namespace };
    const pods = await k8sApi.listNamespacedPod({ namespace: namespace });
    const deploys = await k8sApi2.listNamespacedDeployment(options);

    const matched = deploys.items.find(
      (deploy) =>
        deploy.metadata.annotations &&
        deploy.metadata.annotations["meta.helm.sh/release-name"]
    );

    if (
      matched.metadata.annotations["meta.helm.sh/release-name"] === releaseName
    ) {
      const podStatus = pods.items.map((pod) => ({
        name: pod.metadata.name,
        status: pod.status.phase,
        ready: isPodReady(pod),
        createdAt: pod.metadata.creationTimestamp,
      }));

      res.json({
        namespace,
        releaseName: releaseName || "all",
        podsCount: podStatus.length,
        pods: podStatus,
      });
    } else {
      res.json("Release does not exist");
    }
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({
      error: "Failed to fetch pods",
      message: err.message,
    });
  }
});

// Helper function to check if a pod is ready
function isPodReady(pod) {
  if (pod.status.phase !== "Running") return false;

  const containerStatuses = pod.status.containerStatuses || [];
  if (containerStatuses.length === 0) return false;

  return containerStatuses.every((container) => container.ready);
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
