/* ------------  
   deviceDriverFileSystem.js

   Requires globals.js and deviceDriverFileSystemFileEntry.js

   Prototype to handle all implementation of byte-level detail of file system.
   ------------ */

DeviceDriverFileSystem.prototype = new DeviceDriver();  // "Inherit" from prototype DeviceDriver in deviceDriver.js.

function DeviceDriverFileSystem() {
  // Override the base method pointers.
  //this.driverEntry = krnFSDriverEntry;
  //this.isr = krnFsIsr;
  this.status = "not loaded";
  this.formatted = false;
  this.readData = "";
  this.disk = new Disk();
}

DeviceDriverFileSystem.prototype.driverEntry = function() {
  // Initialization routine for this, the kernel-mode Keyboard Device Driver.
  this.status = "loaded";
};

// function to handle file system ISR operations - read, write, create, delete, format, ls
DeviceDriverFileSystem.prototype.isr = function(params) {
  var command = params[0];
  var filename = params[1];
  var data = params[2];

  if(command === "create") {
    if(this.create(filename)) {
      krnWriteConsole("Successfully create new file: " + filename, true);
    }
  }
  else if(command === "read") {
    if(this.read(filename)) {
      krnWriteConsole(this.readData, true);
    }
  }
  else if(command === "write") {
    if (this.write(filename, data)) {
      krnWriteConsole("Successfully wrote to " + filename, true);
    }
  }
  else if(command === "delete") {
    if (this.delete(filename)) {
      krnWriteConsole("Successfully deleted " + filename, true);
    }
  }
  else if(command === "format") {
    if (this.format()) {
      krnWriteConsole("Successfully formatted the file system", true);
    }
  }
  else if(command === "ls") {
    this.list();
  }
  else if(command === "swapCreate") {
    this.create(filename);
  }
  else if(command === "swapRead") {
    this.read(filename);
  }
  else if(command === "swapWrite") {
    this.write(filename, data);
  }
  else if(command === "swapDelete") {
    this.delete(filename);
  }
};

// returns whether or not the file system is formatted
DeviceDriverFileSystem.prototype.isFormatted = function() {
  if(!this.formatted) {
    krnWriteConsole("Error: file system not formatted yet", true);
    krnTrace("Error: file system not formatted yet");
  }
  return this.formatted;
};

// function to make the string key for local storage
DeviceDriverFileSystem.prototype.makeKey = function(t, s, b) {
  return t + "," + s + "," + b;
};

// funtion to return the last data that was read from the disk
DeviceDriverFileSystem.prototype.getReadData = function() {
  return this.readData;
};

// function to return all the entries in the file system for display
DeviceDriverFileSystem.prototype.getEntries = function() {
  // prevent the display from refreshing if we aren't formatted
  if(!this.formatted)
    return;

  // list of FileEntry objects for every TSB on the disk for display
  var list = [];

  // foreach block in each sector in the directory, grab the entries
  for(var track = 0; track < NUMBER_OF_TRACKS; track++) {
    for (var sector = 0; sector < NUMBER_OF_SECTORS; sector++) {
      for (var block = 0; block < NUMBER_OF_BLOCKS; block++) {

        entry = this.disk.getEntry(this.makeKey(track, sector, block));
        var fileEntry = new FileEntry();
        fileEntry.parseEntry(entry);
        list[list.length] = fileEntry;
      
      }
    }
  }

  return list;
};

// function to read the directory and return all the files
DeviceDriverFileSystem.prototype.getDirEntries = function() {
  var entry = "";
  var list = [];

  // foreach block in each sector in the directory, grab the entries,
  // check to see if they are in use, i.e. they have an entry
  for(var track = 0; track < 1; track++) {
    for (var sector = 0; sector < NUMBER_OF_SECTORS; sector++) {
      for (var block = 0; block < NUMBER_OF_BLOCKS; block++) {
        
        entry = this.disk.getEntry(this.makeKey(track, sector, block));
        var fileEntry = new FileEntry();
        fileEntry.parseEntry(entry);
        if(fileEntry.isInUse())
          list[list.length] = fileEntry;

      }
    }
  }

  return list;
};

// function to find a specific entrying in the directory and return its TSB
DeviceDriverFileSystem.prototype.findDirEntry = function(filename) {
  var entry = "";

  // foreach block in each sector in the directory, grab the entries,
  // check to see if they are in use, i.e. they have an entry
  for(var track = 0; track < 1; track++) {
    for (var sector = 0; sector < NUMBER_OF_SECTORS; sector++) {
      for (var block = 0; block < NUMBER_OF_BLOCKS; block++) {
        
        // get the file entry on the disk and parse it
        entry = this.disk.getEntry(this.makeKey(track, sector, block));
        var fileEntry = new FileEntry();
        fileEntry.parseEntry(entry);
        // see if it is in use and if it matches the filename we are looking for
        if(fileEntry.isInUse() && fileEntry.data === filename)
          return this.makeKey(track, sector, block);

      }
    }
  }

  return "";
};

// function to get the next open slot in the directory
DeviceDriverFileSystem.prototype.getNextOpenDirEntry = function() {
  var entry = "";

  // foreach block in each sector in the directory, grab the entries,
  // check to see if they are in use, i.e. they have an entry
  for(var track = 0; track < 1; track++) {
    for (var sector = 0; sector < NUMBER_OF_SECTORS; sector++) {
      for (var block = 0; block < NUMBER_OF_BLOCKS; block++) {
        
        // get the file entry on the disk and parse it
        entry = this.disk.getEntry(this.makeKey(track, sector, block));
        var fileEntry = new FileEntry();
        fileEntry.parseEntry(entry);
        // if its not in use then return the TSB
        if(!fileEntry.isInUse())
          return this.makeKey(track, sector, block);

      }
    }
  }

  return null;
};

// function to return the a list of the desired number of open file
// entries or null if not enough open entries are available
DeviceDriverFileSystem.prototype.getOpenFileEntries = function(numOfEntries) {
  if(numOfEntries === 0)
    return null;

  var entry = "";
  var count = 0;
  var list = [];

  // foreach block in each sector in the directory, grab the entries,
  // check to see if they are in use, i.e. they have an entry
  for(var track = 1; track < NUMBER_OF_TRACKS; track++) {
    for (var sector = 0; sector < NUMBER_OF_SECTORS; sector++) {
      for (var block = 0; block < NUMBER_OF_BLOCKS; block++) {
        
        // get the file entry on the disk and parse it
        entry = this.disk.getEntry(this.makeKey(track, sector, block));
        var fileEntry = new FileEntry();
        fileEntry.parseEntry(entry);
        // if the entry is not in use then add it to the list and increment  
        // our count, returning when we have found numOfEntries open entries
        if(!fileEntry.isInUse()) {
          list[list.length] = this.makeKey(track, sector, block);
          count++;
          if(count === numOfEntries)
            return list;
        }
        
      }
    }
  }

  return null;
};


// function to format the file system
DeviceDriverFileSystem.prototype.format = function() {
  // foreach block in each sector in each track, enter the default data
  for(var track = 0; track < NUMBER_OF_TRACKS; track++) {
    for (var sector = 0; sector < NUMBER_OF_SECTORS; sector++) {
      for (var block = 0; block < NUMBER_OF_BLOCKS; block++) {
        
        var blankEntry = new FileEntry();
        if(track === 0 && sector === 0 && block === 0) {
          blankEntry.setData("MBR");
        }
        // set the local storage to a blank file entry - not in use, no link and no data
        this.disk.setEntry(this.makeKey(track, sector, block), blankEntry.toString());

      }
    }
  }

  krnTrace("successfully formatted hard drive");
  this.formatted = true;
  return true;
};

// function to create a file
DeviceDriverFileSystem.prototype.create = function(filename) {
  if(!this.isFormatted()) {
    return false;
  }

  // look for space in the directory and at least one open file entry
  var nextOpenDir = this.getNextOpenDirEntry();
  var openFileEntries = this.getOpenFileEntries(1);
  if(nextOpenDir === null || openFileEntries === null) {
    krnWriteConsole("Error: file system full", true);
    krnTrace("Error: file system full");
    return false;
  }

  // search for a file with our filename and see if it 
  // is not found i.e. the filename isn't already taken
  if(this.findDirEntry(filename) !== "") {
    krnWriteConsole("Error: filename already taken", true);
    krnTrace("Error: filename already taken");
    return false;
  }

  // get the directory slot and set the appropriate 
  // filename and link to a reserved file entry spot
  var entry = new FileEntry();
  entry.parseEntry(this.disk.getEntry(nextOpenDir));
  entry.setData(filename);
  entry.setLink(openFileEntries[0]);

  // reserve the next open file entry spot for this newly created file
  var reserveSpot = new FileEntry();
  reserveSpot.parseEntry(this.disk.getEntry(openFileEntries[0]));
  reserveSpot.setData(""); // TODO - better way to set in use?

  // commit the values to the disk
  this.disk.setEntry(nextOpenDir, entry.toString());
  this.disk.setEntry(openFileEntries[0], reserveSpot.toString());

  krnTrace("successfully created the file " + filename);
  return true;
};

// function to display the contents of a file
DeviceDriverFileSystem.prototype.read = function(filename) {
  if(!this.isFormatted()) {
    return false;
  }

  // search for a file with our filename and see if it 
  // is found i.e. the filename does exist
  var dirTSB = this.findDirEntry(filename);
  if(dirTSB === "") {
    krnWriteConsole("Error: file not found", true);
    krnTrace("Error: file not found");
    return false;
  }

  // parse the entry info from the directory entry
  var entryObj = new FileEntry();
  entryObj.parseEntry(this.disk.getEntry(dirTSB));

  // get the first link to the file data
  var nextLink = entryObj.getStringLink();
  entryObj.parseEntry(this.disk.getEntry(nextLink));

  // extract the first bit of info from the first link in the chain
  var fileData = entryObj.data;

  // go through the rest of the links in the chain and concatenate the data together
  while(entryObj.hasLink()) {
    nextLink = entryObj.getStringLink();
    entryObj.parseEntry(this.disk.getEntry(nextLink));
    fileData += entryObj.data;
  }
  // store the last read data for when we want to display it or when we are swapping
  this.readData = fileData;
  
  krnTrace("successfully read data from file " + filename);
  return true;
};

// function to write data to a file
DeviceDriverFileSystem.prototype.write = function(filename, data) {
  if(!this.isFormatted()) {
    return false;
  }

  // search for a file with our filename and see if it 
  // is found i.e. the file does exist
  var dirTSB = this.findDirEntry(filename);
  if(dirTSB === "") {
    krnWriteConsole("Error: file not found", true);
    krnTrace("Error: file not found");
    return false;
  }

  // go through and delete all the contents of this file
  // since write is an over-write in our implementation
  this.deleteFileContents(dirTSB);

  // go and grab the first link in the chain for this file
  var entryObj = new FileEntry();
  entryObj.parseEntry(this.disk.getEntry(dirTSB));
  var allocatedBlock = entryObj.getStringLink();
  
  // if the data can fit in the block that we already assigned it when we created the file
  if (data.length < BLOCK_SIZE - 4) {
    // just put the data in there
    entryObj = new FileEntry();
    entryObj.setData(data);
    this.disk.setEntry(allocatedBlock, entryObj.toString());
  }
  // otherwise we must spread this file out across several blocks
  else {
    var dataArray = [];
    var maxDataSize = BLOCK_SIZE - 4;
    // grab block size chunks of the data at a time, adding that to a
    // list which we will write to disk and chain all together
    while (data !== "") {
      dataArray[dataArray.length] = data.substring(0, maxDataSize);
      data = data.substring(maxDataSize, data.length);
      if(data.length < maxDataSize)
        maxDataSize = data.length;
    }

    // see if there are enough open blocks on the disk for the size of this write
    // we need as many blocks as split the data into - 1 because when we created
    // the file we reserved one block
    var openFileEntries = this.getOpenFileEntries(dataArray.length - 1);
    if(openFileEntries === null) {
      krnWriteConsole("Error: not enough space in file system", true);
      krnTrace("Error: not enough space in file system");
      return false;
    }

    // variable to keep track of the last link - this is the TSB
    // in which we are writing to, after we write to it we assign
    // it the next open block and continue
    var lastTSB = allocatedBlock;
    
    // go about spreading the data across more than 1 block by
    // adding each chunk of data to each open block we found earlier
    for (var j = 0; j <= openFileEntries.length; j++) {
      entryObj = new FileEntry();
      entryObj.setData(dataArray[j]);
      // set the next link in the chain if we aren't at the last one
      if(j !== openFileEntries.length)
        entryObj.setLink(openFileEntries[j]);
      this.disk.setEntry(lastTSB, entryObj.toString());
      lastTSB = openFileEntries[j];
    }
  }
  
  krnTrace("successfully wrote data to file " + filename);
  return true;
};

// function to remove a file from storage
DeviceDriverFileSystem.prototype.delete = function(filename) {
  if(!this.isFormatted()) {
    return false;
  }

  // get the TSB of the directory entry for this file, i.e.
  // search for a file with our filename and see if it 
  // is found i.e. the file does exist
  var dirTSB = this.findDirEntry(filename);
  if(dirTSB === "") {
    krnWriteConsole("Error: file not found", true);
    krnTrace("Error: file not");
    return false;
  }

  var blankEntry = new FileEntry();
  var entryObj = new FileEntry();

  // parse the entry info from the directory entry in order
  // to get the next link in this file chain
  entryObj.parseEntry(this.disk.getEntry(dirTSB));
  // clear out the directory entry
  this.disk.setEntry(dirTSB, blankEntry.toString());

  // get the first link to the chain from the directory entry we parsed earlier
  var nextLink = entryObj.getStringLink();
  entryObj.parseEntry(this.disk.getEntry(nextLink));
  // clear out this entry
  this.disk.setEntry(nextLink, blankEntry.toString());

  // go through each remaining link of the chain and delete those in similar fashion
  while(entryObj.hasLink()) {
    nextLink = entryObj.getStringLink();
    entryObj.parseEntry(this.disk.getEntry(nextLink));
    this.disk.setEntry(nextLink, blankEntry.toString());
  }

  krnTrace("successfully deleted file " + filename);
  return true;
};

// function to delete the contents of a given file
DeviceDriverFileSystem.prototype.deleteFileContents = function(dirTSB) {
  var blankEntry = new FileEntry();
  var entryObj = new FileEntry();

  // parse the entry info from the directory entry in order
  // to get the first link in this file chain
  entryObj.parseEntry(this.disk.getEntry(dirTSB));

  // get the first link to the chain from the directory entry we parsed earlier
  var nextLink = entryObj.getStringLink();
  entryObj.parseEntry(this.disk.getEntry(nextLink));
  // clear out the first entry's data but still reserve it since we alwasy want
  // to have at least one block for each file that we create
  entryObj.setData("");
  this.disk.setEntry(nextLink, entryObj.toString());

  // go through any remaining links of the chain and replace entries with blank, unused entries
  while(entryObj.hasLink()) {
    nextLink = entryObj.getStringLink();
    entryObj.parseEntry(this.disk.getEntry(nextLink));
    this.disk.setEntry(nextLink, blankEntry.toString());
  }

  return true;
};

// function to list the files currently stored on the disk
DeviceDriverFileSystem.prototype.list = function() {
  if(!this.isFormatted()) {
    return false;
  }

  // make sure there are more than just the msb in the directory track
  var files = this.getDirEntries();
  if(files.length < 2) {
    krnWriteConsole("No files found", true);
    krnTrace("No files found");
    return false;
  }

  // go through all the files and print out the names except for the MBR
  for (var i = 0; i < files.length; i++) {
    if(files[i].data !== "MBR") {
      krnWriteConsole(files[i].data + " ", false);
    }
  }
  krnWriteConsole("", true);

  return true;
};