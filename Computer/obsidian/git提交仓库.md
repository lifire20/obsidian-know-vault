---
tags:
  - git
---
**
#### 1.新建仓库
#### 2.终端打开仓库根目录
#### 3.初始化git
```
git init
```
#### 4.复制仓库地址（https:-）
终端输入
```
git remote add origin https://github.com/xxx/obsidian-creative-vault.git
```
#### 5.在ob仓库根目录创建.gitignore文件（不是txt格式）
文件内输入
```
.obsidian/workspace.json
.obsidian/workspaces.json
.obsidian/plugins/
.obsidian/cache/

.trash/

.DS_Store
Thumbs.db

*.tmp
*.log
```
这个文件可以排除不需要上传到git的目录/文件
#### 6.第一次提交
添加所有文件
```
git add .
```
创建提交
```
git commit -m "Initial commit"
```
#### 7.上传到github
终端输入
```
git branch -M main
```
然后输入
```
git push -u origin main
```
第一次输入可能会报错，再次输入这个命令。
- 如果依旧不成功，尝试给git添加代理
##### （给git添加代理）
打开代理软件，找到代理端口（一般为7890/7897）
然后给git设置代理
终端依次执行这两个
```
git config --global http.proxy http://127.0.0.1:7890 //端口改成实际端口

git config --global https.proxy http://127.0.0.1:7890
```
然后执行
```
git config --global --get http.proxy
```
如果输出`http://127.0.0.1:7890`即为成功，接着可以在终端执行`git push -u origin main`命令

执行`git push -u origin main`的时候，如果是第一次上传库，会要求登陆，登陆后即可执行命令。

- 如果完成以上操作后再次报错，可能是创建仓库的时候勾选了创建README文件，git在问你是否合并
这时候只需要执行
```
git pull origin main --allow-unrelated-histories
```
出现编辑界面的话输入`:q`退出即可

如果报错：
```
D:\ob\zhishiku\konwledge>git push -u origin main
To https://github.com/lifire20/obsidian-study-vault.git
 ! [rejected]        main -> main (fetch first)
error: failed to push some refs to 'https://github.com/lifire20/obsidian-study-vault.git'
hint: Updates were rejected because the remote contains work that you do not
hint: have locally. This is usually caused by another repository pushing to
hint: the same ref. If you want to integrate the remote changes, use
hint: 'git pull' before pushing again.
hint: See the 'Note about fast-forwards' in 'git push --help' for details.

D:\ob\zhishiku\konwledge>
```
只需要执行`git pull --rebase origin main`即可


最后再次执行
```
git push -u origin main
```
即可成功上传



##### （git关闭代理命令）
```
git config --global --unset http.proxy

git config --global --unset https.proxy
```