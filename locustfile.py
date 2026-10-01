from locust import HttpUser, task, between

class VoiceAgentUser(HttpUser):
    # Simulate a realistic delay between user requests
    wait_time = between(1, 3)

    @task
    def simulate_voice_request(self):
        # Simulating an incoming conversational payload
        payload = {
            "text": "Hello, could you explain the architecture?",
            "language": "en"
        }
        
        # Hit the API Gateway endpoint to test latency and routing
        with self.client.post("/api/voice-chat", json=payload, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 503:
                # 503 indicates our graceful fallback was triggered successfully during exhaustion
                response.success() 
            else:
                response.failure(f"Unexpected status code: {response.status_code}")
