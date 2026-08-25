# Projects (your Mac)

On your Mac, Finder home is **moomen**. The folder you highlighted is:

**`/Users/moomen/Projects`**

Put Flowlary **inside** that folder so it sits next to your other 29 items:

**`/Users/moomen/Projects/flowlary`**

A Cloud Agent cannot drop files into your Mac Finder. Copy it on the Mac:

```bash
# From a clone of this repo:
rsync -a --exclude node_modules --exclude .git \
  ./Moomen/Projects/flowlary/ /Users/moomen/Projects/flowlary/

cd /Users/moomen/Projects/flowlary
npm install
npm run build
```

Or: `bash Moomen/Projects/flowlary/scripts/install-to-mac-projects.sh`

Load unpacked in Chrome: `/Users/moomen/Projects/flowlary/extension/dist`
