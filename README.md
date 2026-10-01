# ZEDX Voice AI Gateway (Proof of Concept)

This repository contains the official reproducibility code and benchmarking scripts for the IEEE Short Paper: 
**"Architecting a Cost-Effective, Sub-Second Voice-to-Voice LLM Pipeline for AI Interview Simulation."**

## Architecture Overview

This Proof of Concept (PoC) demonstrates the **Cascaded Low-Latency Architecture** introduced in the paper, focusing on three core contributions:

1. **Language-Dependent TTS Routing:** Dynamically routing Arabic payloads to premium commercial TTS APIs to ensure high dialect fidelity, while redirecting English text to zero-cost Edge TTS APIs. This achieves a mathematically verifiable 65% reduction in operational TTS costs.
2. **Dynamic API Gateway:** Implementing a Round-Robin failover strategy across a distributed token bucket. This prevents rate-limit exhaustion during high-concurrency traffic spikes.
3. **Graceful Fallback:** Ensuring 100% High Availability (HA) by falling back to a localized cache and pre-rendered audio responses during catastrophic pool exhaustion.

## Repository Contents

*   `gateway.ts`: A simplified Node.js/Express implementation of the API Gateway. It showcases the Token-Bucket load balancer logic, the graceful fallback mechanism, and the conditional TTS routing interceptor.
*   `locustfile.py`: The Python-based Locust load-testing script used to generate the p50 and p99 latency metrics presented in **Table I** of the paper.

## Reproducing the Benchmark (Stress Test)

To reproduce the load testing metrics (100 concurrent connections):

### 1. Start the API Gateway
Ensure you have Node.js installed, then run the gateway:
```bash
npm install express @types/express ts-node
npx ts-node gateway.ts
```

### 2. Run the Locust Load Test
Ensure you have Python installed, then run the benchmark script:
```bash
pip install locust
locust -f locustfile.py --host=http://localhost:3000
```

### 3. Execute the Stress Load
1. Open `http://localhost:8089` in your web browser.
2. Set **Number of users** to `100` and **Spawn rate** to `10` to simulate the concurrent stress load detailed in the paper.
3. Observe the `p50` and `p99` response times in the Locust dashboard, which will validate the sub-second baseline reasoning latency reported in the study.
