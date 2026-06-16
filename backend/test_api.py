import requests

def test():
    # Login
    res = requests.post("http://localhost:8000/api/v1/auth/login", data={"username": "admin", "password": "password"})
    token = res.json().get("access_token")
    if not token:
        print("Login failed")
        return

    headers = {"Authorization": f"Bearer {token}"}
    
    # Get prices
    res = requests.get("http://localhost:8000/api/v1/hauling/projects/1/hauling-prices", headers=headers)
    print("GET prices:", res.status_code)
    print(res.json())

    # Create global price
    payload = {
        "project_id": 1,
        "vendor_id": None,
        "price_per_unit": 77777,
        "effective_date": "2026-06-16"
    }
    res = requests.post("http://localhost:8000/api/v1/hauling/projects/1/hauling-prices", json=payload, headers=headers)
    print("POST global price:", res.status_code)
    print(res.json())

    # Get prices again
    res = requests.get("http://localhost:8000/api/v1/hauling/projects/1/hauling-prices", headers=headers)
    print("GET prices after:", res.status_code)
    print(res.json())

if __name__ == "__main__":
    test()
