---
tags:
  - Linux
  - 文件传输
---

进入文件所在目录后
命令为
```
D:\浏览器下载>scp apache-zookeeper-3.7.0-bin.tar.gz lvruitong@192.168.125.101:/home/lvruitong/bigdata
The authenticity of host '192.168.125.101 (192.168.125.101)' can't be established.
ED25519 key fingerprint is SHA256:K8sqLhgQ+H5jf585+b7KqtVEFUGVoRFOI9IrRpyY6VU.
This key is not known by any other names
Are you sure you want to continue connecting (yes/no/[fingerprint])?
Warning: Permanently added '192.168.125.101' (ED25519) to the list of known hosts.
lvruitong@192.168.125.101's password:
apache-zookeeper-3.7.0-bin.tar.gz                                                     100%   12MB 107.5MB/s   00:00

D:\浏览器下载>
```

如果输入要切换的目录却切换不成功的话，就再输入对应的盘符
```
C:\Users\firemers>cd D:\浏览器下载

C:\Users\firemers>D:
```