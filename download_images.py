import csv
import requests
import os
import time 

csv_filepath = 'images.csv' # Changeme
download_folder = 'images_folder_python'
os.makedirs(download_folder, exist_ok=True) # Create folder if it doesn't exist

with open(csv_filepath, mode='r', encoding='utf-8') as csvfile:
    csv_reader = csv.reader(csvfile)
    header = next(csv_reader, None) # Skip header row if it exists
    if header:
        print(f"Header row: {header}")

    for row in csv_reader:
        try:
            image_url = row[3].strip() # Assuming URL is in the 4th column now (index 3, MLB, Variation ID, Image Index, Image URL), adjust if needed
            if not image_url: # Skip empty URLs
                continue

            # Construct filename from column 1 and column 2, and ensure they exist
            col1_data = row[0].strip() if len(row) > 0 else "col1_missing"
            col2_data = row[1].strip() if len(row) > 1 else "col2_missing"
            base_filename = f"{col1_data}-{col2_data}.jpg"
            filename = os.path.join(download_folder, base_filename)

            print(f"Downloading image from: {image_url} to {filename}")

            response = requests.get(image_url, stream=True, timeout=10) # Stream for large files, timeout for robustness
            response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
            time.sleep(0.1);

            with open(filename, 'wb') as outfile:
                for chunk in response.iter_content(chunk_size=8192): # Write in chunks for efficiency
                    outfile.write(chunk)
            print(f"Downloaded {filename}")

        except requests.exceptions.RequestException as e:
            print(f"Error downloading image from {image_url}: {e}")
        except Exception as e:
            print(f"Error processing row: {row}, Error: {e}")

print("Image download process complete.")