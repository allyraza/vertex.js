require("./PNodePermissions");

PNode = Proto.clone().newSlots({
	protoType: "PNode",
	pdb: null,
	pid: 0,
	mRecord: null,
	sRecord: null,
	pRecord: null,
	permissions: null
}).setSlots({

	init: function()
	{
		this._pdb = null;
		this._pid = 0;
		this._mRecord = PRecord.clone();
		this._sRecord = PRecord.clone();
		this._pRecord = PRecord.clone();
	},
	
	setPdb: function(pdb)
	{
		this._pdb = pdb;
		this._mRecord.setPdb(pdb);
		this._sRecord.setPdb(pdb);
		this._pRecord.setPdb(pdb);
		return this;
	},
	
	setPid: function(pid)
	{
		if (pid.toString() == "[object Object]") 
		{
			throw new "pid is object";
		}
		this._pid = pid
		this._mRecord.setPrefix(pid + "/m/");
		this._sRecord.setPrefix(pid + "/s/");
		this._pRecord.setPrefix(pid + "/p/");
		return this;
	},
	
	permissions: function()
	{
		if(this._permissions) { return this._permissions; }
		
		this._permissions = PNodePermissions.clone().setNode(this);
		this._permissions.read();
		
		//writeln("returning this._permissions = " + this._permissions)
		return this._permissions;
	},

	at: function(k)
	{
		var pid = this.sRecord().at(k);
		
		if (pid) 
		{
			if (pid.toString() == "[object Object]") 
			{
				this.rm(k);
				writeln("this.sRecord().fullKey(k)  = ", this.sRecord().fullKey(k));
				writeln("pid  = ", JSON.stringify(pid));
				writeln("removing slot to repair!")
				throw new "pid is object";
			}
			return this._pdb.nodeForPid(pid);
		}
		
		return null;
	},

	mk: function(k)
	{
		var node = this.at(k);
		
		if (node == null) 
		{
			node = PNode.clone().setPdb(this._pdb).create();
			this.atPut(k, node.pid());
		}
		
		return node;
	},

	//-- creation ---------------------------------------------------------------

	newPid: function()
	{
		var maxPid = Math.pow(2, 30);
		while (1) 
		{
			var pid = Math.floor(Math.random() * maxPid);
			if (this._pdb.at(pid + "/p/size") == null) 
			{
				this.setPid(pid);
				break;
			}
		}
	},

	exists: function()
	{
		return this.pRecord().hasKey("size");
	},

	create: function()
	{
		this.newPid();
		this.pRecord().zeroKey("size");
		return this;
	},

	//-- paths ----------------------------------------------------------

	isWritableByUser: function(user)
	{
		return this.permissions().isWritableByUser(user);
	},
	
	isReadableByUser: function(user)
	{
		return this.permissions().isReadableByUser(user);
	},
	
	/*
	nodeAtPath: function(path, user)
	{
		var path = path.removePrefix("/");
		return this.nodeAtPathComponents(path.pathComponents().map(decodeURIComponent), user);
	},
	*/

	nodeAtPathComponents: function(pathComponents, user)
	{
		pathComponents = pathComponents.copy();
		var node = this;
		var k = pathComponents.removeAt(0);
			
		if(user && !node.permissions().isReadableByUser(user))
		{
			throw new Error("insufficient read permissions on path " + user.description() + " " + this.permissions().description());
		}
		
		if (k == null || k == "") 
		{ 
			return this;
		}
	
		var nextPNode = node.at(k);
	
		if (nextPNode == null) 
		{ 
			return null;
		}
	
		return nextPNode.nodeAtPathComponents(pathComponents, user);
	},

	createPNodeAtPath: function(path, user)
	{
		return this.createPNodeAtPathComponents(path.pathComponents(), user);
	},

	createPNodeAtPathComponents: function(pathComponents, user)
	{
		var node = this;
		var k = pathComponents.removeAt(0);
	
		if (k == null)
		{ 
			return this;
		}
		
		if (k == "")
		{
			throw new Error("Can't create node at empty key");
		}
				
		if(user && !node.permissions().isReadableByUser(user))
		{
			throw new Error("insufficient read permissions on path " + user.description() + " " + this.permissions().description());
		}
		
		var nextPNode = node.at(k);
		
		if(!nextPNode)
		{
			if(user && !node.permissions().isWritableByUser(user))
			{
				throw new Error("insufficient write permissions on path");
			}
			
			nextPNode = node.mk(k);
		}
		
		return nextPNode.createPNodeAtPathComponents(pathComponents, user);
	},

	createPNodeAt: function(key)
	{
		return this.createPNodeAtPathComponents([key]);
	},

	//-- size ---------------------------------------------------------------

	size: function()
	{
		return new Number(this.pRecord().at("size"));
	},

	//-- ops ---------------------------------------------------------------

	link: function(k, aPNode)
	{
		if (aPNode) 
		{
			this.atPut(k, aPNode.pid());
			return this;
		}
	
		return null;
	},

	//-- slot ops ---------------------------------------------------------------

	hasSlot: function(k)
	{
		return this.sRecord().hasKey(k);
	},
	
	rename: function(k1, k2)
	{
		if(k1 == k2) return this;
		var v = this.at(k1);
		if (v != null)
		{
			writeln("rename(" + k1 + ", " + k2 + ") = ", v.pid());
			if(k2 && k2 != "") this.atPut(k2, v.pid());
			this.removeAt(k1);
		}
		return this;
	},

	atPut: function(k, v)
	{
		var hadKey = this.hasSlot(k);
		this.sRecord().atPut(k, v);
	
		if (hadKey == false) 
		{
			this.pRecord().incrementKey("size");
		}
	
		return this
	},

	rm: function(k)
	{
		return this.removeAt(k)
	},

	removeAt: function(k)
	{
		//writeln(this.pid(), " rm: ", k);
		var hadKey = this.hasSlot(k)
		this.sRecord().removeAt(k)
	
		if (hadKey) 
		{
			var size = this.pRecord().decrementKey("size")
			if (size < 0) 
			{
				writeln("ERROR: PNode negative size written")
			}
		}
	
		return this
	},

	removeAll: function()
	{
		var count = 0
		var c = this.sRecord().cursor()
	
		c.first()
		while (c.key()) 
		{
			count = count + 1
			c.out()
		}
	
		this.pRecord().atPut("size", count.toString());
		return this
	},
	
	mRemoveAll: function()
	{
		var count = 0
		var c = this.mRecord().cursor()
	
		c.first()
		while (c.key()) 
		{
			c.out()
		}
	
		return this
	},

	//-- mRecord ops ---------------------------------------------------------------

	mwrite: function(k, v)
	{
		this.mRecord().atPut(k, v);
		return this
	},

	mread: function(k)
	{
		return this.mRecord().at(k);
	},

	mrm: function(k)
	{
		return this.mRecord().removeAt(k);
	},
	
	mrename: function(k1, k2)
	{
		if(k1 != k2)
		{
			var v = this.mread(k1);
			if(v && (k2 != "")) { this.mwrite(k2, v); }
			this.mrm(k1);
		}
		return this;
	},
	
	//-- type mRecord value -----------------------------

	setType: function(v)
	{
		this.mwrite("type", v);
		//this._object = null;
		return this;
	},

	type: function(v)
	{
		return this.mread("type");
	},

	//-- data mRecord value -----------------------------

	setData: function(v)
	{
		this.mwrite("data", v);
		return this;
	},

	data: function(v)
	{
		return this.mread("data");
	},

	//-- cursors -----------------------------------------

	slotCursor: function()
	{
		var c = this.sRecord().cursor();
		c.setNode(this);
		return c;
	},

	mRecordCursor: function()
	{
		var c = this.mRecord().cursor();
		//c.setNode(this);
		return c;
	},
	
	deepCopySlotTo: function(k1, k2)
	{
		this.atPut(k2, this.at(k1).deepCopy().pid());
		return this;
	},
	
	deepCopy: function()
	{
		if(this.hasRefLoop() != false)
		{
			throw "ref loop found on deepCopy attempt";
		}
		
		var newNode = PNode.clone().setPdb(this._pdb).create();

		var c = this.slotCursor();	
		c.first();
		while(c.key())
		{
			var subnode = this.at(c.key());
			newNode.atPut(c.key(), subnode.deepCopy().pid());
			c.next()
		}
		
		var c = this.mRecordCursor();	
		c.first();
		while(c.key())
		{
			newNode.mwrite(c.key(), c.value());
			c.next()
		}
		
		return newNode;
	},
	
	hasRefLoop: function(refs) // returns pid if there is a loop
	{
		if(refs == null) { refs = {}; }
		var c = this.slotCursor();	
		c.first();
		while(c.key())
		{
			var pid = c.value();
			if(refs[pid] == null)
			{
				var subnode = this._pdb.nodeForPid(pid);
				refs[pid] = 1;
				var loopFound = subnode.hasRefLoop(refs);
				if(loopFound != false)
				{
					return loopFound;
				}
			}
			else
			{
				return pid; // loop detected;
			}
			c.next();
		}
		
		return false;
	},
	
	keys: function()
	{
		return this.slotCursor().keys();
	},
	
	//-- iterators -----------------------------------------
	
	eachSlot: function(fn, reverse)
	{
		var cur = this.slotCursor();
		
		if(reverse)
		{
			cur.last();
		}
		else
		{
			cur.first();
		}
		
		var k;
		while(k = cur.key())
		{
			var node = this.at(k);
			if(fn.call(node, node, k))
			{
				break;
			}
			
			if (reverse)
			{
				cur.prev();
			}
			else
			{
				cur.next();
			}
		}
		
		return this;
	},
	
	eachSlotReverse: function(fn)
	{
		return this.eachSlot(fn, true);
	},
	
	asJsonObject: function(shallow)
	{
		var obj = {};
		this.eachSlot(function(subNode, subNodeKey){
			if (!subNode) 
			{
				writeln("asJsonObject: warning no subnode at ", subNodeKey);
				return;
			}
			var data = subNode.mread("data");
			var type = subNode.mread("type");

			var convertedData;
			if(data && type)
			{
				if(type == "Number")
				{
					convertedData = data.asNumber();
				}
				else if(type == "Date")
				{
					convertedData = data.asNumber();
				}
				else
				{
					// assume it's a String?
					convertedData = data;
				}
				obj[subNodeKey] = convertedData;
			}
			else if(!shallow)
			{
				obj[subNodeKey] = subNode.asJsonObject();
			}
		});
		
		return obj;
	},
	
	setJsonObject: function(obj)
	{
		this.removeAll();
		this.mRemoveAll();
		
		for(var k in obj)
		{
			var v = obj[k];
			var t = typeof(v);
			var subNode = this.mk(k);
			
			if(t == "string")
			{
				subNode.mwrite("type", "String");
				subNode.mwrite("data", v);
			}
			else if (t == "number")
			{
				subNode.mwrite("type", "Number");
				subNode.mwrite("data", v.asString());
			}
			else
			{
				subNode.setJsonObject(v);
			}
		}
		
		return this;	
	},
	
	asObject: function()
	{
		var name = this.mread("type");
		
		//writeln("type: '" + this.mread("type") + "'")
		//writeln("data: '" + this.mread("data") + "'")
		
		if(!name)
		{
			return null;
		}
		
		var proto = global[name];
		if(!proto) 	
		{
			throw new Error("unable to load proto type '", name, "'");
		}
		
		if(name == "String")
		{
			return this.mread("data");
		}
		else if(name == "Number")
		{
			return this.mread("data").asNumber();
		}
		else
		{
			throw new Error("unknown type " + name);
		}
		
		
		return proto;
	},
	
	objectAt: function(k)
	{
		var v = this.at(k);
		
		if(v) 
		{
			var obj = v.asObject();
			//writeln("obj = ", typeof(obj));

			return obj;
		}
		
		return null;	
	},
		
	stringAt: function(k)
	{
		return this.objectAt(k);
	},
	
	/*
	atPutObject: function(k, v)
	{
		var node = this.rm(k).mk(k)
		node.mwrite("type", v.protoType());
		if(v.storeOnNode) v.storeOnNode(node);
		return this;
	},
	*/
	
	atPutString:function(k, s)
	{
		if(typeof(s) != "string") 
		{
			throw new Error("expected string argument");
		}
		
		return this.atPutData(k, s);
	},
	
	atPutData: function(k, data)
	{
		var node = this.rm(k).mk(k)
		var dataType = null;
		
		if(typeof(data) == "string") 
		{
			dataType = "String";
		}
		
		if(typeof(data) == "number")
		{
			dataType = "Number";
		}
		
		if(!dataType) 
		{
			throw new Error("unknown data type");
		}
		
		node.mwrite("type", dataType);
		node.mwrite("data", data);
		return this;
	},
	
	unusedSlotName: function(prefix)
	{
		if(!prefix) prefix = "untitled";
		if(!this.at(prefix)) return prefix;
		var n = 1;
		while (this.at(prefix + n) != null) { n = n + 1; }
		return prefix + n;
	},
	
	unusedMetaSlotName: function(prefix)
	{
		if(!prefix) prefix = "untitled";
		if(!this.mread(prefix)) return prefix;
		var n = 1;
		while (this.mread(prefix + n) != null) { n = n + 1; }
		return prefix + n;
	},	
})
