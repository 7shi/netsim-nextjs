TARGET = out/index-cdn.html
VERSION := $(shell node -p "require('./package.json').version")
URL = https://cdn.jsdelivr.net/gh/7shi/netsim-nextjs@$(VERSION)

all: $(TARGET)

$(TARGET): out/index.html
	python conv-cdn.py $< | sed 's|/_next/|$(URL)/out/_next/|g' > $@

dev:
	npm run dev

build:
	npx next build

pyhttp:
	python -m http.server -d out 3000

clean:
	rm -f $(TARGET)

.PHONY: all dev build clean
