TARGET = out/index-cdn.html
LATEST_TAG := $(shell git describe --tags --abbrev=0)

all: $(TARGET)

build:
	npx next build

$(TARGET): out/index.html
	python conv-cdn.py $< | sed 's|/_next/|https://cdn.jsdelivr.net/gh/7shi/netsim-nextjs@$(LATEST_TAG)/out/_next/|g' > $@

clean:
	rm -f $(TARGET)
