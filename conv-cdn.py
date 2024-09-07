# pip install beautifulsoup4
from bs4 import BeautifulSoup

import sys

def extract_scripts_and_links(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()

    soup = BeautifulSoup(content, 'html.parser')

    elements = soup.find_all(['script', 'link'])

    for element in elements:
        if element.name == 'script':
            print(element)
        elif element.name == 'link':
            print(element)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python conv-cdn.py <path to HTML file>")
        sys.exit(1)

    file_path = sys.argv[1]
    extract_scripts_and_links(file_path)
