import cv2
import pickle
import pandas as pd
from datetime import date

# Load trained model
with open("model.pkl", "rb") as file:
    model = pickle.load(file)

# Test image
img = cv2.imread("dataset/horlicks/1786064787800.jpg")

img = cv2.resize(img, (100, 100))
img = img.flatten()

# Predict product
prediction = model.predict([img])

product_name = prediction[0]

print("Predicted Product:", product_name)

# Read inventory data
df = pd.read_csv("products.csv")

# Find predicted product (case-insensitive)
product = df[df["Product"].str.strip().str.lower() == product_name.strip().lower()]

if not product.empty:

    expiry_date = pd.to_datetime(
        product.iloc[0]["ExpiryDate"]
    ).date()

    quantity = product.iloc[0]["Quantity"]
    category = product.iloc[0]["Category"]

    today = date.today()

    days_left = (expiry_date - today).days

    print("\nProduct Details:")
    print("Product:", product_name)
    print("Category:", category)
    print("Quantity:", quantity)
    print("Expiry Date:", expiry_date)
    print("Days Left:", days_left)

    if days_left < 0:
        print("Status: EXPIRED")

    elif days_left <= 7:
        print("Status: EXPIRING SOON")

    else:
        print("Status: SAFE")