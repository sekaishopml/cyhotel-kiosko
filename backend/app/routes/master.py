"""Master routes — scope master, sin HOTEL_ID."""
def master_routes():
    return [
        "GET /api/master/hotels",
        "GET /api/master/dashboard",
        "GET /api/master/orders",
    ]
