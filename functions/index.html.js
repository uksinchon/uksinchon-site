export function onRequest({request}) {
 if(!['GET','HEAD'].includes(request.method))return new Response('Method Not Allowed',{status:405,headers:{Allow:'GET, HEAD'}});
 return new Response(null,{status:308,headers:{Location:'/'+new URL(request.url).search,'Cache-Control':'public, max-age=0, must-revalidate'}});
}
