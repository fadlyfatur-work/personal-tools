import { AuthForm } from '../components/auth-form'
export default async function Page({searchParams}:{searchParams:Promise<{next?:string;error?:string}>}){const params=await searchParams;return <AuthForm mode="login" next={params.next} callbackError={Boolean(params.error)}/>}
