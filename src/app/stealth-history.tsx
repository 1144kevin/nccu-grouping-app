import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { DetailHeader, EmptyState, Pill, PrimaryButton, Screen } from '@/components/primitives';
import { useAuthStore } from '@/store/auth-store';
import { stealthApi, type StealthHistoryItem } from '@/lib/stealth-api';
import { displayTimestamp } from '@/lib/display-time';
import { stealthLocations } from '@/components/stealth-request-summary';
import { colors, radius, spacing } from '@/theme/tokens';
const emoji: Record<string,string> = { pizza:'🍕', meal:'🍱', drink:'🧋', bakery:'🥐', snack:'🍪' };
const status: Record<string,string> = { active:'配對中', revoked:'已停止', consumed:'已成團', expired:'已過期', formed:'已成團' };
export default function StealthHistory() {
  const actor=useAuthStore((s)=>s.user?.id);
  const [expanded,setExpanded]=useState<string>();
  const query=useInfiniteQuery({ queryKey:['core',actor,'stealth','history'], enabled:!!actor,
    queryFn:({pageParam})=>stealthApi.history(pageParam), initialPageParam:undefined as {cursor_time:string;cursor_id:string}|undefined,
    getNextPageParam:(page)=>{const last=page.items.at(-1);return page.has_more&&last?{cursor_time:last.created_at,cursor_id:last.id}:undefined;} });
  const rows=query.data?.pages.flatMap((page)=>page.items) ?? [];
  function row(item:StealthHistoryItem) {return <View key={item.id}>
    <Pressable accessibilityRole="button" accessibilityLabel={`查看偷揪 ${item.title}`} onPress={()=>item.formed_post_id?router.push(`/order/${item.formed_post_id}`):setExpanded(expanded===item.id?undefined:item.id)} style={styles.row}>
      <View style={styles.image}><Text style={styles.emoji}>{emoji[item.category] ?? '🍱'}</Text></View>
      <View style={styles.info}><Text numberOfLines={2} style={styles.title}>{item.title}</Text><Text style={styles.detail}>{displayTimestamp(item.created_at)}</Text></View>
      <Pill>{status[item.status] ?? item.status}</Pill><MaterialCommunityIcons name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
    {expanded===item.id&&!item.formed_post_id?<View style={styles.expanded}><Text>{stealthLocations[item.location_id] ?? item.location_id}</Text><Text>{displayTimestamp(item.starts_at)} ～ {displayTimestamp(item.ends_at)}</Text><Text>{item.budget_max_twd==null?'預算未設定':`預算 NT$ ${item.budget_max_twd}`}</Text></View>:null}
  </View>}
  return <Screen><DetailHeader title="偷揪紀錄"/><ScrollView contentContainerStyle={styles.content}>
    {query.isPending?<EmptyState loading icon="history" title="載入中"/>:query.error?<><Text accessibilityRole="alert">紀錄載入失敗</Text><PrimaryButton onPress={()=>void query.refetch()}>重試</PrimaryButton></>:rows.length?rows.map(row):<EmptyState icon="history" title="還沒有偷揪紀錄"/>}
    {query.hasNextPage?<PrimaryButton secondary disabled={query.isFetchingNextPage} onPress={()=>void query.fetchNextPage()}>載入更多</PrimaryButton>:null}
  </ScrollView></Screen>;
}
const styles=StyleSheet.create({content:{padding:spacing.lg,paddingBottom:100,gap:10},row:{flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:colors.border,borderRadius:radius.md,overflow:'hidden',minHeight:88,gap:8},image:{width:88,height:88,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface},emoji:{fontSize:33},info:{flex:1,minWidth:0,paddingHorizontal:9},title:{color:colors.ink,fontWeight:'700',fontSize:15},detail:{marginTop:5,color:colors.muted,fontSize:12},expanded:{padding:spacing.md,gap:6}});
