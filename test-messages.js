import pkg from 'osc';
const { UDPPort } = pkg;

// Create UDP client
const client = new UDPPort({
    localAddress: "0.0.0.0",
    localPort: 7000
});

client.open();

client.on("ready", () => {
    console.log("Test client ready");

    // Test 1: Simulate user joining
    setTimeout(() => {
        console.log("Test 1: Simulating user join");
        client.send({
            address: "/zoomosc/user/online",
            args: [1, "Test User", 0, "12345"]
        }, "0.0.0.0", 8003);
    }, 1000);

    // Test 2: Send a chat message
    setTimeout(() => {
        console.log("Test 2: Sending chat message");
        client.send({
            address: "/zoomosc/user/chat",
            args: [1, "Test User", 0, "12345", "Hello from test client!", "msg123"]
        }, "0.0.0.0", 8003);
    }, 2000);

    // Test 3: Send a broadcast message
    setTimeout(() => {
        console.log("Test 3: Sending broadcast message");
        client.send({
            address: "/zoom/chatAll",
            args: ["Broadcast test message"]
        }, "0.0.0.0", 8003);
    }, 3000);

    // Test 4: Simulate user leaving
    setTimeout(() => {
        console.log("Test 4: Simulating user leave");
        client.send({
            address: "/zoomosc/user/offline",
            args: [1, "Test User", 0, "12345"]
        }, "0.0.0.0", 8003);
        
        // Close after all tests
        setTimeout(() => {
            client.close();
            process.exit(0);
        }, 1000);
    }, 4000);
});

client.on("error", (err) => {
    console.error("Error:", err);
}); 